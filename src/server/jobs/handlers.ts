import "server-only";
import type { Job, PgBoss } from "pg-boss";
import { QUEUES, type AgentRunPayload } from "./queues";
import {
  findDueSchedules,
  recordScheduleOutcome,
  runApprovalExpiryTick,
  runBillingTick,
  runDigestTick,
} from "./tick";

/**
 * Job-Handler des Workers.
 *
 * Die Handler bleiben schmal: Sie rufen die Fachlogik aus `tick.ts` und der
 * Runtime auf und übersetzen deren Ergebnis in Warteschlangenbegriffe. Alles,
 * was fachlich entscheidet, ist dort und damit ohne Worker testbar.
 *
 * pg-boss 12 übergibt Handlern ein **Array** von Jobs. Jeder Handler
 * verarbeitet die Jobs einzeln, damit ein Fehler in einem Job nicht die
 * gesamte Charge scheitern lässt.
 */

function log(message: string, detail?: Record<string, unknown>): void {
  // Strukturierte Zeile — im Betrieb von einem Log-Sammler auswertbar.
  console.log(
    JSON.stringify({ scope: "worker", at: new Date().toISOString(), message, ...detail }),
  );
}

export async function registerHandlers(boss: PgBoss): Promise<void> {
  /* --------------------------------------------------------------------- */
  /* Herzschlag: fällige Zeitpläne einreihen                               */
  /* --------------------------------------------------------------------- */
  await boss.work(QUEUES.scheduleTick, async () => {
    const result = await findDueSchedules(new Date());
    for (const item of result.due) {
      // Idempotenzschlüssel aus Zeitplan und Fenster: Selbst wenn dieser Job
      // wiederholt wird, entsteht kein zweiter Lauf.
      await boss.send(QUEUES.agentRun, item.payload, {
        singletonKey: `${item.scheduleId}:${item.slot}`,
      });
    }
    if (result.due.length > 0 || result.skipped.length > 0) {
      log("Zeitpläne geprüft", {
        geprueft: result.checked,
        eingereiht: result.due.length,
        uebersprungen: result.skipped.length,
        gruende: result.skipped.map((s) => s.reason),
      });
    }
  });

  /* --------------------------------------------------------------------- */
  /* Agentenlauf                                                           */
  /* --------------------------------------------------------------------- */
  await boss.work<AgentRunPayload>(
    QUEUES.agentRun,
    // Zwei gleichzeitig: Agentenläufe kosten Geld, ein unbegrenzter Schwarm
    // wäre im Fehlerfall teuer.
    { batchSize: 2 },
    async (jobs: Job<AgentRunPayload>[]) => {
      for (const job of jobs) {
        await handleAgentRun(job);
      }
    },
  );

  /* --------------------------------------------------------------------- */
  /* Tageszusammenfassungen                                                */
  /* --------------------------------------------------------------------- */
  await boss.work(QUEUES.digest, async () => {
    const result = await runDigestTick(new Date());
    if (result.delivered > 0) {
      log("Tageszusammenfassungen versendet", { ...result });
    }
  });

  /* --------------------------------------------------------------------- */
  /* Abrechnung                                                            */
  /* --------------------------------------------------------------------- */
  await boss.work(QUEUES.billing, async () => {
    const result = await runBillingTick(new Date());
    if (result.invoiced > 0 || result.skipped.length > 0) {
      log("Abrechnungslauf", {
        organisationen: result.organizations,
        rechnungen: result.invoiced,
        uebersprungen: result.skipped.length,
      });
    }
  });

  /* --------------------------------------------------------------------- */
  /* Abgelaufene Freigaben                                                 */
  /* --------------------------------------------------------------------- */
  await boss.work(QUEUES.approvalExpiry, async () => {
    const result = await runApprovalExpiryTick(new Date());
    if (result.expired > 0) {
      log("Freigaben abgelaufen", { anzahl: result.expired });
    }
  });

  /* --------------------------------------------------------------------- */
  /* Endlager                                                              */
  /* --------------------------------------------------------------------- */
  await boss.work(QUEUES.deadLetter, async (jobs: Job<AgentRunPayload>[]) => {
    // Endgültig gescheiterte Jobs werden nicht stillschweigend verworfen: Sie
    // stehen im Log und bleiben 30 Tage in der Warteschlange einsehbar.
    for (const job of jobs) {
      log("Job endgültig gescheitert", {
        queue: job.name,
        jobId: job.id,
        organisation: job.data?.organizationId,
        faehigkeit: job.data?.capabilityKey,
      });
      if (job.data?.scheduleId && job.data.organizationId) {
        await recordScheduleOutcome({
          scheduleId: job.data.scheduleId,
          organizationId: job.data.organizationId,
          ok: false,
          status: "Alle Wiederholungen aufgebraucht",
        });
      }
    }
  });
}

/**
 * Führt einen geplanten Agentenlauf aus.
 *
 * Wichtig ist die Unterscheidung zweier Fehlerarten:
 *
 * - **Kontingent erschöpft** ist kein Fehler des Laufs, sondern ein erwarteter
 *   Zustand. Wiederholen würde nichts ändern, also wird der Job als erledigt
 *   behandelt und der Zeitplan vermerkt den Grund.
 * - **Alles andere** wird geworfen, damit pg-boss die konfigurierten
 *   Wiederholungen mit exponentiellem Abstand fährt.
 */
async function handleAgentRun(job: Job<AgentRunPayload>): Promise<void> {
  const { startRun, QuotaExceededError } = await import(
    "@/server/agents/runtime/engine"
  );
  const payload = job.data;

  try {
    const outcome = await startRun({
      organizationId: payload.organizationId,
      instanceId: payload.instanceId,
      capabilityKey: payload.capabilityKey,
      goal: payload.goal,
      input: payload.input ?? {},
      trigger: {
        type: "schedule",
        scheduleId: payload.scheduleId ?? null,
        slot: payload.slot ?? null,
      },
      sandbox: false,
      requestedByUserId: null,
      // Derselbe Zeitplan im selben Fenster erzeugt nie zwei Läufe — die
      // Runtime gibt bei bekanntem Schlüssel den bestehenden Lauf zurück.
      idempotencyKey:
        payload.scheduleId && payload.slot
          ? `schedule:${payload.scheduleId}:${payload.slot}`
          : null,
    });

    const ok = outcome.status === "completed" || outcome.status === "waiting_approval";
    if (payload.scheduleId) {
      await recordScheduleOutcome({
        scheduleId: payload.scheduleId,
        organizationId: payload.organizationId,
        ok,
        runId: outcome.runId,
        status: outcome.summary ?? outcome.status,
      });
    }
    log("Geplanter Lauf beendet", {
      organisation: payload.organizationId,
      faehigkeit: payload.capabilityKey,
      status: outcome.status,
      runId: outcome.runId,
    });

    if (!ok) {
      // Fehlgeschlagene Läufe sollen wiederholt werden — der Fehler steht
      // bereits im Lauf, hier zählt nur die Wiederholung.
      throw new Error(`Lauf endete mit Status "${outcome.status}".`);
    }
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      log("Geplanter Lauf abgelehnt: Kontingent erschöpft", {
        organisation: payload.organizationId,
        faehigkeit: payload.capabilityKey,
      });
      if (payload.scheduleId) {
        await recordScheduleOutcome({
          scheduleId: payload.scheduleId,
          organizationId: payload.organizationId,
          ok: false,
          status: "Kontingent erschöpft — Lauf nicht gestartet",
        });
      }
      // Kein Wurf: Wiederholen würde am Kontingent nichts ändern.
      return;
    }
    throw error;
  }
}
