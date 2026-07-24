"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireOrg, requirePermission, PermissionError } from "@/server/auth/guards";
import { withOrg } from "@/server/db/client";
import { agentInstance } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { getAgentDefinition } from "@/server/agents/catalog";
import { runSandboxTest } from "@/server/agents/runtime/sandbox";
import { configuratorAnswersSchema } from "@/server/configurator/logic";
import { markCompleted, saveStep } from "./service";
import { ONBOARDING_STEPS, ONBOARDING_STEP_COUNT } from "./steps";

export interface OnboardingActionResult {
  ok: boolean;
  message: string;
  /** Ergebnisdetails je Agent (Sandbox-Schritt). */
  details?: { name: string; ok: boolean; message: string }[];
}

function failure(err: unknown): OnboardingActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Onboarding-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

const stepKeys = ONBOARDING_STEPS.map((s) => s.key) as [string, ...string[]];

const saveSchema = z.object({
  stepKey: z.enum(stepKeys),
  nextStep: z.number().int().min(1).max(ONBOARDING_STEP_COUNT),
  answers: configuratorAnswersSchema.partial().optional(),
  selectedAgents: z.array(z.string().max(60)).max(60).optional(),
});

export async function saveOnboardingStep(
  input: z.infer<typeof saveSchema>,
): Promise<OnboardingActionResult> {
  try {
    const ctx = await requireOrg();
    const parsed = saveSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: "Ungültige Eingabe für diesen Schritt." };
    }
    await saveStep({
      organizationId: ctx.organizationId,
      stepKey: parsed.data.stepKey,
      nextStep: parsed.data.nextStep,
      answers: parsed.data.answers,
      selectedAgents: parsed.data.selectedAgents,
    });
    revalidatePath("/onboarding/einrichtung");
    return { ok: true, message: "Gespeichert." };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Legt die ausgewählten Agenten an — immer im Sandbox-Modus.
 * Der Produktivbetrieb beginnt erst nach bestandenem Testlauf (Schritt 13/14).
 */
export async function createSelectedAgents(
  slugs: string[],
): Promise<OnboardingActionResult> {
  try {
    const ctx = await requirePermission("agents", "activate");
    const valid = [...new Set(slugs)].filter((s) => getAgentDefinition(s));
    if (valid.length === 0) {
      return { ok: false, message: "Bitte wählen Sie mindestens einen Agenten." };
    }
    let created = 0;
    for (const slug of valid) {
      const def = getAgentDefinition(slug)!;
      const defaultTools = [
        ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
      ];
      const inserted = await withOrg(ctx.organizationId, (tx) =>
        tx
          .insert(agentInstance)
          .values({
            organizationId: ctx.organizationId,
            definitionSlug: def.slug,
            displayName: def.personaName,
            status: "sandbox",
            allowedTools: defaultTools,
            responsibleUserId: ctx.userId,
          })
          .onConflictDoNothing()
          .returning({ id: agentInstance.id }),
      );
      if (inserted.length > 0) {
        created++;
        await recordAudit({
          organizationId: ctx.organizationId,
          actorType: "user",
          actorId: ctx.userId,
          actorLabel: ctx.session.user.name,
          action: "agent.hired",
          targetType: "agent_instance",
          targetId: inserted[0]!.id,
          summary: `${def.personaName} (${def.roleTitle}) wurde im Einrichtungsassistenten angelegt (Sandbox).`,
        });
      }
    }
    revalidatePath("/onboarding/einrichtung");
    revalidatePath("/app/workforce");
    return {
      ok: true,
      message:
        created > 0
          ? `${created} Agent(en) im Sandbox-Modus angelegt.`
          : "Alle gewählten Agenten sind bereits angelegt.",
    };
  } catch (err) {
    return failure(err);
  }
}

/** Sandbox-Testlauf für alle noch nicht getesteten Agenten. */
export async function runSandboxForAll(): Promise<OnboardingActionResult> {
  try {
    const ctx = await requirePermission("agents", "test");
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx.select().from(agentInstance),
    );
    const pending = rows.filter((r) => r.sandboxPassedAt === null);
    if (pending.length === 0) {
      return {
        ok: true,
        message: "Alle Agenten haben den Sandbox-Testlauf bereits bestanden.",
      };
    }
    const details: { name: string; ok: boolean; message: string }[] = [];
    for (const row of pending) {
      try {
        const outcome = await runSandboxTest({
          organizationId: ctx.organizationId,
          instanceId: row.id,
          requestedByUserId: ctx.userId,
          requestedByLabel: ctx.session.user.name,
        });
        details.push({
          name: row.displayName,
          ok: outcome.passed,
          message: outcome.passed
            ? outcome.status === "waiting_approval"
              ? "Bestanden — Freigabe-Flow ausgelöst (Entscheidung im Approval Center)."
              : "Bestanden."
            : (outcome.summary ?? "Nicht bestanden."),
        });
      } catch (err) {
        details.push({
          name: row.displayName,
          ok: false,
          message: err instanceof Error ? err.message : "Testlauf fehlgeschlagen.",
        });
      }
    }
    const passed = details.filter((d) => d.ok).length;
    revalidatePath("/onboarding/einrichtung");
    revalidatePath("/app/workforce");
    revalidatePath("/app/approvals");
    return {
      ok: passed === details.length,
      message: `${passed} von ${details.length} Testläufen bestanden.`,
      details,
    };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Übernimmt Agenten aus der Sandbox in den Produktivbetrieb.
 * Agenten ohne bestandenen Testlauf bleiben in der Sandbox.
 */
export async function activateTestedAgents(
  instanceIds: string[],
): Promise<OnboardingActionResult> {
  try {
    const ctx = await requirePermission("agents", "activate");
    const ids = z.array(z.string()).min(1).max(60).safeParse(instanceIds);
    if (!ids.success) {
      return { ok: false, message: "Bitte mindestens einen Agenten auswählen." };
    }
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx.select().from(agentInstance).where(inArray(agentInstance.id, ids.data)),
    );
    const eligible = rows.filter((r) => r.sandboxPassedAt !== null);
    const blocked = rows.filter((r) => r.sandboxPassedAt === null);

    for (const row of eligible) {
      await withOrg(ctx.organizationId, (tx) =>
        tx
          .update(agentInstance)
          .set({ status: "active", activatedAt: new Date() })
          .where(eq(agentInstance.id, row.id)),
      );
      await recordAudit({
        organizationId: ctx.organizationId,
        actorType: "user",
        actorId: ctx.userId,
        actorLabel: ctx.session.user.name,
        action: "agent.status.active",
        targetType: "agent_instance",
        targetId: row.id,
        summary: `${row.displayName} wurde nach bestandenem Sandbox-Test aktiviert.`,
      });
    }

    revalidatePath("/onboarding/einrichtung");
    revalidatePath("/app/workforce");
    revalidatePath("/app");
    return {
      ok: eligible.length > 0,
      message:
        blocked.length === 0
          ? `${eligible.length} Agent(en) aktiviert.`
          : `${eligible.length} aktiviert. ${blocked.length} bleiben in der Sandbox, weil noch kein Testlauf bestanden wurde: ${blocked.map((b) => b.displayName).join(", ")}.`,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function finishOnboarding(): Promise<OnboardingActionResult> {
  try {
    const ctx = await requireOrg();
    await markCompleted(ctx.organizationId);
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "onboarding.completed",
      summary: "Einrichtungsassistent abgeschlossen.",
    });
    revalidatePath("/app");
    return { ok: true, message: "Einrichtung abgeschlossen." };
  } catch (err) {
    return failure(err);
  }
}
