"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { requirePermission, PermissionError } from "@/server/auth/guards";
import { withOrg } from "@/server/db/client";
import { agentRun, approvalRequest, task } from "@/server/db/schema";
import { startRun } from "./runtime/engine";
import { runSandboxTest } from "./runtime/sandbox";
import { decideApproval } from "./runtime/approvals";
import { getAgentInstance } from "./instances";

export interface RunActionResult {
  ok: boolean;
  message: string;
  runId?: string;
  status?: string;
}

function failure(err: unknown): RunActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Runtime-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

/** Sandbox-Testlauf starten (Voraussetzung für Aktivierung). */
export async function startSandboxTest(
  instanceId: string,
): Promise<RunActionResult> {
  try {
    const ctx = await requirePermission("agents", "test");
    const outcome = await runSandboxTest({
      organizationId: ctx.organizationId,
      instanceId,
      requestedByUserId: ctx.userId,
      requestedByLabel: ctx.session.user.name,
    });
    revalidatePath(`/app/agents/${instanceId}`);
    revalidatePath("/app/activity");
    revalidatePath("/app/approvals");
    return {
      ok: outcome.passed,
      message: outcome.passed
        ? `Sandbox-Test bestanden (${outcome.status === "waiting_approval" ? "inkl. Freigabe-Flow — Entscheidung im Approval Center" : outcome.summary})`
        : `Sandbox-Test nicht bestanden: ${outcome.summary}`,
      runId: outcome.runId,
      status: outcome.status,
    };
  } catch (err) {
    return failure(err);
  }
}

/** Manuellen Lauf einer Fähigkeit starten. */
export async function startManualRun(
  instanceId: string,
  capabilityKey: string,
  inputText: string,
): Promise<RunActionResult> {
  try {
    const ctx = await requirePermission("agents", "run");
    const item = await getAgentInstance(ctx.organizationId, instanceId);
    if (!item) return { ok: false, message: "Agent nicht gefunden." };
    const textSchema = z.string().trim().min(1).max(20_000);
    const parsed = textSchema.safeParse(inputText);
    if (!parsed.success) {
      return { ok: false, message: "Bitte Eingabedaten angeben (max. 20.000 Zeichen)." };
    }
    const outcome = await startRun({
      organizationId: ctx.organizationId,
      instanceId,
      capabilityKey,
      goal: `Manueller Lauf: ${item.definition.capabilities.find((c) => c.key === capabilityKey)?.name ?? capabilityKey}`,
      input: { text: parsed.data },
      trigger: { type: "manual", userId: ctx.userId },
      requestedByUserId: ctx.userId,
    });
    revalidatePath(`/app/agents/${instanceId}`);
    revalidatePath("/app/activity");
    revalidatePath("/app/approvals");
    revalidatePath("/app/tasks");
    return {
      ok: outcome.status !== "failed",
      message: outcome.summary ?? outcome.status,
      runId: outcome.runId,
      status: outcome.status,
    };
  } catch (err) {
    return failure(err);
  }
}

/** Laufenden/wartenden Lauf abbrechen. */
export async function cancelRun(runId: string): Promise<RunActionResult> {
  try {
    const ctx = await requirePermission("agents", "run");
    const updated = await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(agentRun)
        .set({ status: "cancelled", finishedAt: new Date(), summary: "Durch Nutzer abgebrochen." })
        .where(eq(agentRun.id, runId))
        .returning({ id: agentRun.id }),
    );
    if (updated.length === 0) return { ok: false, message: "Lauf nicht gefunden." };
    await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(approvalRequest)
        .set({ status: "cancelled" })
        .where(eq(approvalRequest.runId, runId)),
    );
    revalidatePath("/app/activity");
    revalidatePath("/app/approvals");
    return { ok: true, message: "Lauf abgebrochen." };
  } catch (err) {
    return failure(err);
  }
}

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().max(1000).optional(),
  editedPayloadJson: z.string().max(20_000).optional(),
});

/** Einzelne Freigabe entscheiden (Genehmigen/Ablehnen, optional bearbeitet). */
export async function decideApprovalAction(
  approvalId: string,
  input: z.infer<typeof decisionSchema>,
): Promise<RunActionResult> {
  try {
    const ctx = await requirePermission("approvals", "decide");
    const parsed = decisionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };

    let editedPayload: Record<string, unknown> | null = null;
    if (parsed.data.editedPayloadJson) {
      try {
        editedPayload = JSON.parse(parsed.data.editedPayloadJson) as Record<string, unknown>;
      } catch {
        return { ok: false, message: "Bearbeiteter Inhalt ist kein gültiges JSON." };
      }
    }

    const result = await decideApproval({
      organizationId: ctx.organizationId,
      approvalId,
      userId: ctx.userId,
      userLabel: ctx.session.user.name,
      decision: parsed.data.decision,
      note: parsed.data.note ?? null,
      editedPayload,
    });
    revalidatePath("/app/approvals");
    revalidatePath("/app/activity");
    revalidatePath("/app/tasks");
    revalidatePath("/app");
    return { ok: result.ok, message: result.message };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Sammelfreigabe: ausschließlich für risikoarme, gleichartige Aktionen
 * (gleicher actionType, riskLevel "low") — Spec §14.
 */
export async function bulkApprove(
  approvalIds: string[],
): Promise<RunActionResult> {
  try {
    const ctx = await requirePermission("approvals", "decide");
    const ids = z.array(z.string()).min(1).max(25).parse(approvalIds);
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(approvalRequest)
        .where(inArray(approvalRequest.id, ids)),
    );
    if (rows.length !== ids.length) {
      return { ok: false, message: "Nicht alle Freigaben gefunden." };
    }
    const actionTypes = new Set(rows.map((r) => r.actionType));
    if (actionTypes.size > 1) {
      return {
        ok: false,
        message: "Sammelfreigabe nur für gleichartige Aktionen möglich.",
      };
    }
    if (rows.some((r) => r.riskLevel !== "low")) {
      return {
        ok: false,
        message: "Sammelfreigabe ist nur für risikoarme Aktionen erlaubt.",
      };
    }
    let approved = 0;
    for (const row of rows) {
      const result = await decideApproval({
        organizationId: ctx.organizationId,
        approvalId: row.id,
        userId: ctx.userId,
        userLabel: ctx.session.user.name,
        decision: "approve",
      });
      if (result.ok) approved++;
    }
    revalidatePath("/app/approvals");
    revalidatePath("/app/activity");
    revalidatePath("/app/tasks");
    return { ok: true, message: `${approved} von ${rows.length} Aktionen freigegeben und ausgeführt.` };
  } catch (err) {
    return failure(err);
  }
}

/** Aufgabenstatus umschalten (Tasks-Seite). */
export async function setTaskStatus(
  taskId: string,
  status: "open" | "in_progress" | "done" | "cancelled",
): Promise<RunActionResult> {
  try {
    const ctx = await requirePermission("tasks", "manage");
    const updated = await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(task)
        .set({
          status,
          completedAt: status === "done" ? new Date() : null,
        })
        .where(eq(task.id, taskId))
        .returning({ id: task.id }),
    );
    if (updated.length === 0) return { ok: false, message: "Aufgabe nicht gefunden." };
    revalidatePath("/app/tasks");
    return { ok: true, message: "Aufgabe aktualisiert." };
  } catch (err) {
    return failure(err);
  }
}
