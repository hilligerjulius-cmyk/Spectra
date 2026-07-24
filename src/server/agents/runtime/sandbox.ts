import { eq } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import { agentInstance } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { startRun, type RunOutcome } from "./engine";

/**
 * Sandbox-Testlauf: führt die erste Fähigkeit des Agenten mit kuratierten
 * Demo-Daten und dem deterministischen ScriptedProvider aus — ohne Zugriff
 * auf echte Systeme. Erst nach bestandenem Testlauf kann der Agent aktiviert
 * werden (Spec §17). Ein Lauf gilt als bestanden, wenn er entweder
 * abgeschlossen wurde oder korrekt in den Freigabe-Wartezustand gewechselt
 * ist (der Freigabe-Flow ist Teil des getesteten Verhaltens).
 */

const SANDBOX_INPUTS: Record<string, { goal: string; input: Record<string, unknown> }> = {
  "email-triage": {
    goal: "Sandbox-Test: Beispiel-E-Mail klassifizieren",
    input: {
      text: "Betreff: Dringende Anfrage zu Ihrem Angebot\n\nGuten Tag,\n\nwir haben Ihr Angebot erhalten und hätten dazu Rückfragen. Bitte senden Sie uns bis 15.08.2026 die aktualisierte Preisliste und klären Sie die Lieferzeiten.\n\nMit freundlichen Grüßen\nMax Beispiel, Beispiel GmbH",
    },
  },
  task: {
    goal: "Sandbox-Test: Aufgaben aus Meeting-Notizen extrahieren",
    input: {
      text: "Meeting-Notizen vom Teammeeting:\n- Bitte das Konzept bis 20.08.2026 erstellen und an alle senden.\n- Anna klären, ob das Budget freigegeben ist.\n- Dringend: Server-Wartung vorbereiten und Termin bestätigen.",
    },
  },
  "invoice-intake": {
    goal: "Sandbox-Test: Beispielrechnung verarbeiten",
    input: {
      text: "Muster Lieferanten GmbH\nRechnungsnummer: RE-2026-0815\nRechnungsdatum: 01.07.2026\nGesamtbetrag: 1.190,00 EUR\nIBAN: DE89370400440532013000\nZahlbar bis 31.07.2026",
    },
  },
  "follow-up": {
    goal: "Sandbox-Test: Follow-up für offenes Angebot entwerfen",
    input: {
      text: "Deal: Website-Relaunch Beispiel GmbH. Angebot über 12.000 EUR am 01.07.2026 versendet, seitdem keine Antwort. Kontakt: einkauf@beispiel.de.",
    },
  },
  "meeting-preparation": {
    goal: "Sandbox-Test: Briefing für anstehenden Termin erstellen",
    input: {
      text: "Termin: Strategiegespräch mit der Beispiel GmbH am 20.08.2026. Bisheriger Verlauf: Erstgespräch positiv, Angebot versendet, Rückfragen zu Lieferzeiten offen. Offene Aufgabe: aktualisierte Preisliste senden.",
    },
  },
  "company-memory": {
    goal: "Sandbox-Test: Wissensfrage mit Quellen beantworten",
    input: {
      text: "Frage: Welche Kündigungsfrist gilt für Kunden?\n\n[[chunk:demo-1]] Unsere Verträge haben eine Kündigungsfrist von drei Monaten zum Jahresende. Ausnahmen bedürfen der Schriftform.\n\n[[chunk:demo-2]] Die Preisliste wird jährlich im Januar aktualisiert.",
    },
  },
};

export async function runSandboxTest(params: {
  organizationId: string;
  instanceId: string;
  requestedByUserId: string;
  requestedByLabel: string;
}): Promise<RunOutcome & { passed: boolean }> {
  const instance = await withOrg(params.organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.id, params.instanceId));
    return row ?? null;
  });
  if (!instance) throw new Error("Agent-Instanz nicht gefunden.");

  const scenario = SANDBOX_INPUTS[instance.definitionSlug] ?? {
    goal: "Sandbox-Test: Fähigkeit mit Demo-Daten ausführen",
    input: {
      text: "Demo-Daten für den Sandbox-Testlauf. Aufgabe: Bitte die Beispieldaten prüfen und einen Bericht bis 30.09.2026 erstellen.",
    },
  };

  const outcome = await startRun({
    organizationId: params.organizationId,
    instanceId: params.instanceId,
    capabilityKey:
      // Erste aktivierte Fähigkeit (nicht deaktiviert)
      (await import("@/server/agents/catalog"))
        .getAgentDefinition(instance.definitionSlug)!
        .capabilities.find((c) => !instance.disabledCapabilities.includes(c.key))
        ?.key ?? "",
    goal: scenario.goal,
    input: scenario.input,
    trigger: { type: "sandbox_test" },
    sandbox: true,
    requestedByUserId: params.requestedByUserId,
  });

  const passed =
    outcome.status === "completed" || outcome.status === "waiting_approval";

  if (passed && !instance.sandboxPassedAt) {
    await withOrg(params.organizationId, (tx) =>
      tx
        .update(agentInstance)
        .set({ sandboxPassedAt: new Date() })
        .where(eq(agentInstance.id, params.instanceId)),
    );
    await recordAudit({
      organizationId: params.organizationId,
      actorType: "user",
      actorId: params.requestedByUserId,
      actorLabel: params.requestedByLabel,
      action: "agent.sandbox.passed",
      targetType: "agent_instance",
      targetId: params.instanceId,
      summary: `${instance.displayName} hat den Sandbox-Testlauf bestanden und kann aktiviert werden.`,
    });
  }

  return { ...outcome, passed };
}
