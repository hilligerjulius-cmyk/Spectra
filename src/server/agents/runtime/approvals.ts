import { and, eq } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import {
  agentInstance,
  agentRun,
  agentStep,
  approvalRequest,
} from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { ACTION_TOOL_MAP } from "./engine";
import { getTool, type ToolContext } from "./tools";

/**
 * Freigabe-Entscheidung ("Prepared Action"-Muster, siehe ADR-007):
 * Bei Genehmigung führt die Runtime exakt die vorbereitete Aktion aus —
 * optional mit der vom Menschen bearbeiteten Fassung des Payloads.
 */

export interface DecideApprovalParams {
  organizationId: string;
  approvalId: string;
  userId: string;
  userLabel: string;
  decision: "approve" | "reject";
  note?: string | null;
  /** Vom Menschen bearbeitete Fassung der Aktion (nur bei approve). */
  editedPayload?: Record<string, unknown> | null;
}

export interface DecisionResult {
  ok: boolean;
  message: string;
}

export async function decideApproval(
  params: DecideApprovalParams,
): Promise<DecisionResult> {
  const approval = await withOrg(params.organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(approvalRequest)
      .where(eq(approvalRequest.id, params.approvalId));
    return row ?? null;
  });
  if (!approval) return { ok: false, message: "Freigabe nicht gefunden." };
  if (approval.status !== "pending") {
    return { ok: false, message: "Diese Freigabe wurde bereits entschieden." };
  }
  if (approval.expiresAt && approval.expiresAt < new Date()) {
    await withOrg(params.organizationId, (tx) =>
      tx
        .update(approvalRequest)
        .set({ status: "expired" })
        .where(eq(approvalRequest.id, params.approvalId)),
    );
    return { ok: false, message: "Diese Freigabe ist abgelaufen." };
  }

  const instance = await withOrg(params.organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.id, approval.agentInstanceId));
    return row ?? null;
  });

  if (params.decision === "reject") {
    await withOrg(params.organizationId, (tx) =>
      tx
        .update(approvalRequest)
        .set({
          status: "rejected",
          decidedByUserId: params.userId,
          decidedAt: new Date(),
          decisionNote: params.note ?? null,
        })
        .where(eq(approvalRequest.id, params.approvalId)),
    );
    if (approval.runId) {
      await finalizeRunAfterDecision(
        params.organizationId,
        approval.runId,
        "completed",
        `Aktion "${approval.title}" wurde abgelehnt${params.note ? ` (${params.note})` : ""}.`,
        { phase: "verify", title: "Freigabe abgelehnt", detail: { entscheiderIn: params.userLabel } },
      );
    }
    await recordAudit({
      organizationId: params.organizationId,
      actorType: "user",
      actorId: params.userId,
      actorLabel: params.userLabel,
      action: "approval.rejected",
      targetType: "approval_request",
      targetId: approval.id,
      summary: `Freigabe abgelehnt: ${approval.title}`,
      metadata: { note: params.note ?? null },
    });
    return { ok: true, message: "Aktion abgelehnt." };
  }

  // Genehmigung: vorbereitete Aktion ausführen
  const toolKey = ACTION_TOOL_MAP[approval.actionType];
  const tool = toolKey ? getTool(toolKey) : undefined;
  if (!tool) {
    return {
      ok: false,
      message: `Für den Aktionstyp "${approval.actionType}" ist kein Ausführungs-Tool registriert.`,
    };
  }
  // Defense in Depth: die menschliche Freigabe ersetzt die Autonomie-Prüfung
  // des Agenten, nicht aber die Tool-Freigabe der Organisation.
  if (instance && !instance.allowedTools.includes(toolKey)) {
    return {
      ok: false,
      message: `Das Tool "${toolKey}" ist für diesen Agenten nicht freigegeben. Bitte zuerst die Berechtigungen anpassen.`,
    };
  }

  const run = approval.runId
    ? await withOrg(params.organizationId, async (tx) => {
        const [row] = await tx
          .select()
          .from(agentRun)
          .where(eq(agentRun.id, approval.runId!));
        return row ?? null;
      })
    : null;

  const payload = params.editedPayload ?? approval.payload;
  const toolCtx: ToolContext = {
    organizationId: params.organizationId,
    instanceId: approval.agentInstanceId,
    runId: approval.runId ?? "approval-direct",
    sandbox: run?.sandbox ?? false,
    requestedByUserId: params.userId,
  };

  let resultSummary: string;
  try {
    const result = await tool.execute(toolCtx, payload);
    resultSummary = result.summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (approval.runId) {
      await finalizeRunAfterDecision(
        params.organizationId,
        approval.runId,
        "failed",
        `Ausführung nach Freigabe fehlgeschlagen: ${message}`,
        { phase: "execute", title: "Ausführung fehlgeschlagen", detail: { fehler: message }, status: "error" },
      );
    }
    return { ok: false, message: `Ausführung fehlgeschlagen: ${message}` };
  }

  await withOrg(params.organizationId, (tx) =>
    tx
      .update(approvalRequest)
      .set({
        status: "approved",
        decidedByUserId: params.userId,
        decidedAt: new Date(),
        decisionNote: params.note ?? null,
        editedPayload: params.editedPayload ?? null,
      })
      .where(eq(approvalRequest.id, params.approvalId)),
  );

  if (approval.runId) {
    await finalizeRunAfterDecision(
      params.organizationId,
      approval.runId,
      "completed",
      `Freigegeben und ausgeführt: ${resultSummary}`,
      {
        phase: "execute",
        title: `Nach Freigabe ausgeführt: ${approval.title}`,
        detail: {
          entscheiderIn: params.userLabel,
          bearbeitet: Boolean(params.editedPayload),
          ergebnis: resultSummary,
        },
      },
    );
  }

  await recordAudit({
    organizationId: params.organizationId,
    actorType: "user",
    actorId: params.userId,
    actorLabel: params.userLabel,
    action: "approval.approved",
    targetType: "approval_request",
    targetId: approval.id,
    summary: `Freigabe erteilt und ausgeführt: ${approval.title} — ${resultSummary}`,
    metadata: {
      actionType: approval.actionType,
      edited: Boolean(params.editedPayload),
      agentInstanceId: approval.agentInstanceId,
      agentName: instance?.displayName ?? null,
    },
  });

  return { ok: true, message: `Freigegeben und ausgeführt: ${resultSummary}` };
}

/**
 * Nach einer Entscheidung: Schritt am Lauf protokollieren; der Lauf wird erst
 * abgeschlossen, wenn KEINE Freigabe mehr offen ist (mehrere Freigaben je
 * Lauf sind möglich). Fehlgeschlagene Ausführungen beenden den Lauf sofort.
 */
async function finalizeRunAfterDecision(
  organizationId: string,
  runId: string,
  status: "completed" | "failed",
  summary: string,
  step: {
    phase: string;
    title: string;
    detail?: Record<string, unknown>;
    status?: "ok" | "error";
  },
): Promise<void> {
  await withOrg(organizationId, async (tx) => {
    const [run] = await tx
      .select({ stepCount: agentRun.stepCount })
      .from(agentRun)
      .where(eq(agentRun.id, runId));
    if (!run) return;
    await tx.insert(agentStep).values({
      organizationId,
      runId,
      index: run.stepCount,
      phase: step.phase,
      title: step.title,
      detail: step.detail ?? null,
      status: step.status ?? "ok",
    });
    const pending = await tx
      .select({ id: approvalRequest.id })
      .from(approvalRequest)
      .where(
        and(
          eq(approvalRequest.runId, runId),
          eq(approvalRequest.status, "pending"),
        ),
      );
    const stillPending = pending.length > 0 && status !== "failed";
    await tx
      .update(agentRun)
      .set({
        stepCount: run.stepCount + 1,
        ...(stillPending
          ? {}
          : { status, summary, finishedAt: new Date() }),
      })
      .where(eq(agentRun.id, runId));
  });
}
