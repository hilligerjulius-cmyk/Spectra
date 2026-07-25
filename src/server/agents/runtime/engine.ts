import { eq, sql } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import {
  agentInstance,
  agentRun,
  agentStep,
  approvalRequest,
} from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { getAIProvider, type AITaskType, type AITaskResult } from "@/server/ai";
import {
  getAgentDefinition,
  type AgentCapabilityDef,
  type AgentDefinitionData,
  type AutomationLevel,
  type RiskLevel,
} from "@/server/agents/catalog";
import { checkUsageAllowance, recordUsage } from "@/server/billing/service";
import { getTool, type ToolContext, type ToolResult } from "./tools";
import { resolveHandler } from "./handlers";
// Seiteneffekte: vollständige Tool-Registry und Capability-Handler.
// Reihenfolge ist bedeutsam — vertiefte Handler zuerst, danach füllen die
// Archetyp-Handler alle übrigen Katalogfähigkeiten auf, ohne sie zu verdrängen.
import "./tools-init";
import "./handlers-core";
import "./handlers-init";

/**
 * Agent-Runtime-Engine: führt Läufe mit Schritten, Limits, Kosten-Tracking
 * und Human-in-the-Loop-Freigaben aus.
 *
 * Architekturentscheidung (ADR-007): Freigaben folgen dem "Prepared Action"-
 * Muster — der Agent bereitet die Aktion vollständig strukturiert vor
 * (ApprovalRequest.payload); bei Genehmigung führt die Runtime genau diese
 * Aktion aus (kein erneuter Agentenlauf). Das ist deterministisch,
 * revisionsfähig und verhindert Abweichungen zwischen Freigabe und Ausführung.
 */

const DEFAULT_MAX_STEPS = 20;
const MAX_DURATION_MS = 120_000;
/** Kostenlimit je Lauf in Zehntel-Cent (2 €). */
const MAX_COST_DECI_CENTS_PER_RUN = 2_000;
const MAX_TOOL_CALLS_PER_RUN = 15;

export class RunLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RunLimitError";
  }
}

export class RunCancelledError extends Error {
  constructor() {
    super("Lauf wurde abgebrochen.");
    this.name = "RunCancelledError";
  }
}

/** Das Abrechnungs-Kontingent der Organisation ist ausgeschöpft. */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

/** Zuordnung Freigabe-Aktionstyp → ausführendes Tool. */
export const ACTION_TOOL_MAP: Record<string, string> = {
  "task.create": "tasks.write",
  "briefing.create": "briefing.write",
  "notification.send": "notify.send",
  "email.draft": "email.draft",
  "email.send": "email.send",
  "calendar.create": "calendar.write",
  "knowledge.create": "knowledge.write",
  "document.create": "documents.write",
  "agent.dispatch": "agents.dispatch",
  "agent.pause": "agents.pause",
};

export interface PreparedAction {
  actionType: keyof typeof ACTION_TOOL_MAP | string;
  title: string;
  /** Sichere, kurze Begründung (keine internen Gedankengänge). */
  reasoning: string;
  payload: Record<string, unknown>;
  affectedData?: Record<string, unknown>;
  riskLevel: RiskLevel;
}

export type PreparedActionOutcome =
  | { mode: "drafted" }
  | { mode: "executed"; result: ToolResult }
  | { mode: "approval_requested"; approvalId: string };

export interface HandlerContext {
  organizationId: string;
  runId: string;
  sandbox: boolean;
  instance: typeof agentInstance.$inferSelect;
  definition: AgentDefinitionData;
  capability: AgentCapabilityDef;
  /** Effektive Automatisierungsstufe dieser Fähigkeit. */
  level: AutomationLevel;
  input: Record<string, unknown>;
  ai<T extends AITaskType>(
    taskType: T,
    input: string,
    context?: string,
  ): Promise<AITaskResult<T>["data"]>;
  invokeTool(key: string, input: unknown): Promise<ToolResult>;
  recordStep(
    phase: string,
    title: string,
    detail?: Record<string, unknown>,
  ): Promise<void>;
  /** Setzt die Automatisierungsstufen-Logik um (Entwurf/Freigabe/Ausführung). */
  prepareAction(action: PreparedAction): Promise<PreparedActionOutcome>;
}

export interface HandlerResult {
  summary: string;
  output?: Record<string, unknown>;
}

export type CapabilityHandler = (
  ctx: HandlerContext,
) => Promise<HandlerResult>;

export interface StartRunParams {
  organizationId: string;
  instanceId: string;
  capabilityKey: string;
  goal: string;
  input?: Record<string, unknown>;
  trigger: { type: string; [key: string]: unknown };
  sandbox?: boolean;
  requestedByUserId?: string | null;
  idempotencyKey?: string | null;
}

export interface RunOutcome {
  runId: string;
  status: string;
  summary: string | null;
}

function effectiveLevel(
  instance: typeof agentInstance.$inferSelect,
  cap: AgentCapabilityDef,
): AutomationLevel {
  if (instance.disabledCapabilities.includes(cap.key)) return 0;
  const override = instance.automationOverrides[cap.key];
  const level = override ?? cap.defaultAutomationLevel;
  return Math.min(level, cap.maxAutomationLevel) as AutomationLevel;
}

/** Erstellt einen Lauf und führt ihn aus (synchron; Retries via pg-boss möglich). */
export async function startRun(params: StartRunParams): Promise<RunOutcome> {
  const instance = await withOrg(params.organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.id, params.instanceId));
    return row ?? null;
  });
  if (!instance) throw new Error("Agent-Instanz nicht gefunden.");

  const definition = getAgentDefinition(instance.definitionSlug);
  if (!definition) throw new Error("Katalogdefinition nicht gefunden.");
  const capability = definition.capabilities.find(
    (c) => c.key === params.capabilityKey,
  );
  if (!capability) throw new Error("Unbekannte Fähigkeit.");

  const sandbox = params.sandbox ?? instance.status === "sandbox";
  if (!sandbox && instance.status !== "active") {
    throw new Error(
      `Agent ist ${instance.status === "paused" ? "pausiert" : "nicht aktiv"} — es werden keine Läufe ausgeführt.`,
    );
  }

  // Abrechnungs-Kontingent prüfen, bevor Kosten entstehen. Sandbox-Läufe
  // sind ausgenommen, damit das Testen nie am Kontingent scheitert.
  const allowance = await checkUsageAllowance(params.organizationId, {
    sandbox,
  });
  if (!allowance.allowed) {
    throw new QuotaExceededError(
      allowance.reason ?? "Das Abrechnungs-Kontingent ist ausgeschöpft.",
    );
  }

  // Idempotenz: existiert bereits ein Lauf mit diesem Schlüssel, nicht doppelt ausführen.
  if (params.idempotencyKey) {
    const existing = await withOrg(params.organizationId, (tx) =>
      tx
        .select({ id: agentRun.id, status: agentRun.status, summary: agentRun.summary })
        .from(agentRun)
        .where(eq(agentRun.idempotencyKey, params.idempotencyKey!)),
    );
    if (existing.length > 0) {
      return {
        runId: existing[0]!.id,
        status: existing[0]!.status,
        summary: existing[0]!.summary,
      };
    }
  }

  const [run] = await withOrg(params.organizationId, (tx) =>
    tx
      .insert(agentRun)
      .values({
        organizationId: params.organizationId,
        agentInstanceId: instance.id,
        definitionSlug: instance.definitionSlug,
        capabilityKey: capability.key,
        trigger: params.trigger,
        goal: params.goal,
        status: "queued",
        input: params.input ?? {},
        sandbox,
        maxSteps: DEFAULT_MAX_STEPS,
        requestedByUserId: params.requestedByUserId ?? null,
        idempotencyKey: params.idempotencyKey ?? null,
      })
      .returning(),
  );

  return executeRun(run!.id, params.organizationId);
}

/** Führt einen angelegten Lauf aus. */
export async function executeRun(
  runId: string,
  organizationId: string,
): Promise<RunOutcome> {
  const run = await withOrg(organizationId, async (tx) => {
    const [row] = await tx.select().from(agentRun).where(eq(agentRun.id, runId));
    return row ?? null;
  });
  if (!run) throw new Error("Lauf nicht gefunden.");

  const instance = await withOrg(organizationId, async (tx) => {
    const [row] = await tx
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.id, run.agentInstanceId));
    return row ?? null;
  });
  if (!instance) throw new Error("Agent-Instanz nicht gefunden.");
  const definition = getAgentDefinition(instance.definitionSlug)!;
  const capability = definition.capabilities.find(
    (c) => c.key === run.capabilityKey,
  )!;
  const level = effectiveLevel(instance, capability);

  const startedAt = new Date();
  await withOrg(organizationId, (tx) =>
    tx
      .update(agentRun)
      .set({ status: "running", startedAt })
      .where(eq(agentRun.id, runId)),
  );

  let stepIndex = 0;
  let toolCalls = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let totalCostDeciCents = 0;
  let pendingApprovals = 0;
  let model: string | null = null;

  const provider = getAIProvider({ sandbox: run.sandbox });

  async function assertNotCancelled() {
    const [current] = await withOrg(organizationId, (tx) =>
      tx
        .select({ status: agentRun.status })
        .from(agentRun)
        .where(eq(agentRun.id, runId)),
    );
    if (current?.status === "cancelled") throw new RunCancelledError();
  }

  async function recordStep(
    phase: string,
    title: string,
    detail?: Record<string, unknown>,
    status: "ok" | "error" | "blocked" = "ok",
    usage?: { promptTokens: number; completionTokens: number; costDeciCents: number },
  ) {
    if (stepIndex >= (run!.maxSteps ?? DEFAULT_MAX_STEPS)) {
      throw new RunLimitError(
        `Maximale Schrittzahl (${run!.maxSteps}) erreicht — Lauf abgebrochen.`,
      );
    }
    if (Date.now() - startedAt.getTime() > MAX_DURATION_MS) {
      throw new RunLimitError("Maximale Laufzeit überschritten — Lauf abgebrochen.");
    }
    if (totalCostDeciCents > MAX_COST_DECI_CENTS_PER_RUN) {
      throw new RunLimitError("Kostenlimit für diesen Lauf erreicht — abgebrochen.");
    }
    await assertNotCancelled();
    await withOrg(organizationId, (tx) =>
      tx.insert(agentStep).values({
        organizationId,
        runId,
        index: stepIndex++,
        phase,
        title,
        detail: detail ?? null,
        status,
        promptTokens: usage?.promptTokens ?? 0,
        completionTokens: usage?.completionTokens ?? 0,
        costDeciCents: usage?.costDeciCents ?? 0,
      }),
    );
  }

  const toolCtx: ToolContext = {
    organizationId,
    instanceId: instance.id,
    runId,
    sandbox: run.sandbox,
    requestedByUserId: run.requestedByUserId,
  };

  const ctx: HandlerContext = {
    organizationId,
    runId,
    sandbox: run.sandbox,
    instance,
    definition,
    capability,
    level,
    input: (run.input ?? {}) as Record<string, unknown>,

    async ai(taskType, input, context) {
      const result = await provider.run({
        taskType,
        input,
        context: context ?? definition.systemPrompt,
      });
      totalPromptTokens += result.usage.promptTokens;
      totalCompletionTokens += result.usage.completionTokens;
      totalCostDeciCents += result.usage.costDeciCents;
      model = result.usage.model;
      await recordStep(
        "reason",
        `KI-Verarbeitung: ${taskType}`,
        { provider: provider.name, model: result.usage.model },
        "ok",
        result.usage,
      );
      return result.data;
    },

    async invokeTool(key, input) {
      if (toolCalls >= MAX_TOOL_CALLS_PER_RUN) {
        throw new RunLimitError("Tool-Aufruf-Limit erreicht — Lauf abgebrochen.");
      }
      // Berechtigungsprüfung: Instanz-Freigabe UND Fähigkeits-Anforderung
      if (!instance.allowedTools.includes(key)) {
        await recordStep(
          "execute",
          `Tool "${key}" verweigert`,
          { grund: "Nicht in den freigegebenen Tools der Instanz" },
          "blocked",
        );
        throw new Error(`Tool "${key}" ist für diesen Agenten nicht freigegeben.`);
      }
      if (!capability.requiredTools.includes(key)) {
        await recordStep(
          "execute",
          `Tool "${key}" verweigert`,
          { grund: `Fähigkeit "${capability.key}" benötigt dieses Tool nicht` },
          "blocked",
        );
        throw new Error(
          `Tool "${key}" gehört nicht zur aktiven Fähigkeit "${capability.key}".`,
        );
      }
      const tool = getTool(key);
      if (!tool) throw new Error(`Unbekanntes Tool "${key}".`);
      toolCalls++;
      try {
        const result = await tool.execute(toolCtx, input);
        await recordStep("execute", `Tool: ${tool.name}`, {
          tool: key,
          outputSummary: result.summary,
        });
        return result;
      } catch (err) {
        await recordStep(
          "execute",
          `Tool "${key}" fehlgeschlagen`,
          { fehler: err instanceof Error ? err.message : String(err) },
          "error",
        );
        throw err;
      }
    },

    recordStep: (phase, title, detail) => recordStep(phase, title, detail),

    async prepareAction(action) {
      // Stufe 0/1: keine Aktionen — nur beobachten
      if (level <= 1) {
        await recordStep("draft", `Beobachtung: ${action.title}`, {
          hinweis: "Automatisierungsstufe erlaubt keine Aktion — nur Meldung.",
        });
        return { mode: "drafted" };
      }
      // Stufe 2: nur Entwurf
      if (level === 2) {
        await recordStep("draft", `Entwurf erstellt: ${action.title}`, {
          aktionstyp: action.actionType,
        });
        return { mode: "drafted" };
      }
      // Stufe 4/5: risikoarme Aktionen direkt ausführen
      if (level >= 4 && action.riskLevel === "low") {
        const toolKey = ACTION_TOOL_MAP[action.actionType];
        if (!toolKey) {
          throw new Error(`Kein Ausführungs-Tool für Aktionstyp "${action.actionType}".`);
        }
        const result = await ctx.invokeTool(toolKey, action.payload);
        return { mode: "executed", result };
      }
      // Stufe 3 (oder höheres Risiko): Freigabe anfordern; der Handler kann
      // weitere Aktionen vorbereiten — der Lauf wartet am Ende auf alle.
      const [approval] = await withOrg(organizationId, (tx) =>
        tx
          .insert(approvalRequest)
          .values({
            organizationId,
            runId,
            agentInstanceId: instance.id,
            capabilityKey: capability.key,
            actionType: action.actionType,
            title: action.title,
            reasoning: action.reasoning,
            payload: action.payload,
            affectedData: action.affectedData ?? null,
            riskLevel: action.riskLevel,
            estimatedCostDeciCents: totalCostDeciCents,
            status: "pending",
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          })
          .returning({ id: approvalRequest.id }),
      );
      await recordStep("request_approval", `Freigabe angefordert: ${action.title}`, {
        aktionstyp: action.actionType,
        risiko: action.riskLevel,
      });
      // Eine wartende Freigabe muss jemanden erreichen — sonst bleibt der
      // Vorgang unbemerkt liegen. Sandbox-Läufe melden nur in der Anwendung.
      await notifyApprovalRecipient({
        organizationId,
        instance,
        sandbox: run!.sandbox,
        title: action.title,
        reasoning: action.reasoning,
        riskLevel: action.riskLevel,
      });
      pendingApprovals++;
      return { mode: "approval_requested", approvalId: approval!.id };
    },
  };

  let usageSettled = false;
  /**
   * Schreibt den Verbrauch genau einmal je Lauf fort — auch bei Abbruch oder
   * Fehler, weil dabei ebenfalls KI-Kosten entstanden sein können.
   * Sandbox-Läufe zählen nicht gegen das Kontingent.
   */
  async function settleUsage() {
    if (usageSettled || run!.sandbox) return;
    usageSettled = true;
    await recordUsage(organizationId, "agent_run", 1);
    await recordUsage(organizationId, "ai_cost", totalCostDeciCents);
  }

  async function finalize(
    status: string,
    summary: string,
    output?: Record<string, unknown>,
    error?: string,
  ): Promise<RunOutcome> {
    await settleUsage();
    await withOrg(organizationId, (tx) =>
      tx
        .update(agentRun)
        .set({
          status,
          summary,
          output: output ?? null,
          error: error ?? null,
          model,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          costDeciCents: totalCostDeciCents,
          stepCount: stepIndex,
          finishedAt: status === "waiting_approval" ? null : new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        })
        .where(eq(agentRun.id, runId)),
    );
    await recordAudit({
      organizationId,
      actorType: "agent",
      actorId: instance!.id,
      actorLabel: `${instance!.displayName} (${definition.roleTitle})`,
      action: `agent.run.${status}`,
      targetType: "agent_run",
      targetId: runId,
      summary: `${run!.sandbox ? "[Sandbox] " : ""}${summary}`,
      metadata: { capabilityKey: capability.key, costDeciCents: totalCostDeciCents },
    });
    return { runId, status, summary };
  }

  try {
    if (level === 0) {
      return await finalize(
        "completed",
        `Fähigkeit "${capability.name}" ist deaktiviert (Stufe 0) — keine Ausführung.`,
      );
    }
    await recordStep("plan", `Ziel: ${run.goal}`, {
      faehigkeit: capability.name,
      stufe: level,
    });
    const handler = resolveHandler(definition.slug, capability.key);
    const result = await handler(ctx);
    await recordStep("report", "Ergebnis erstellt", {
      zusammenfassung: result.summary,
    });
    if (pendingApprovals > 0) {
      const summary = `${result.summary} — ${pendingApprovals} Aktion(en) warten auf Freigabe.`;
      await settleUsage();
      await withOrg(organizationId, (tx) =>
        tx
          .update(agentRun)
          .set({
            status: "waiting_approval",
            summary,
            output: result.output ?? null,
            model,
            promptTokens: totalPromptTokens,
            completionTokens: totalCompletionTokens,
            costDeciCents: totalCostDeciCents,
            stepCount: stepIndex,
            durationMs: Date.now() - startedAt.getTime(),
          })
          .where(eq(agentRun.id, runId)),
      );
      await recordAudit({
        organizationId,
        actorType: "agent",
        actorId: instance.id,
        actorLabel: `${instance.displayName} (${definition.roleTitle})`,
        action: "agent.run.waiting_approval",
        targetType: "agent_run",
        targetId: runId,
        summary: `${run.sandbox ? "[Sandbox] " : ""}${summary}`,
      });
      return { runId, status: "waiting_approval", summary };
    }
    return await finalize("completed", result.summary, result.output);
  } catch (err) {
    if (err instanceof RunCancelledError) {
      return await finalize("cancelled", "Lauf wurde durch Nutzer abgebrochen.");
    }
    const message = err instanceof Error ? err.message : String(err);
    // Ein fehlgeschlagener Lauf bleibt sonst unbemerkt, bis jemand ins
    // Aktivitätsprotokoll schaut.
    await notifyRunFailure({
      organizationId,
      instance,
      sandbox: run.sandbox,
      capabilityName: capability.name,
      message,
    });
    if (err instanceof RunLimitError) {
      return await finalize("failed", `Limit erreicht: ${message}`, undefined, message);
    }
    return await finalize("failed", `Lauf fehlgeschlagen: ${message}`, undefined, message);
  }
}

/**
 * Meldet eine wartende Freigabe an die verantwortliche Person — ersatzweise an
 * alle Entscheidungsberechtigten. Fehler beim Melden dürfen den Lauf nicht
 * scheitern lassen: Die Freigabe existiert bereits und ist im Approval Center
 * sichtbar; die Benachrichtigung ist ein zusätzlicher Weg, kein Ersatz.
 */
async function notifyApprovalRecipient(params: {
  organizationId: string;
  instance: typeof agentInstance.$inferSelect;
  sandbox: boolean;
  title: string;
  reasoning: string;
  riskLevel: RiskLevel;
}): Promise<void> {
  try {
    const { notify, notifyOrganization } = await import(
      "@/server/notifications/service"
    );
    const payload = {
      organizationId: params.organizationId,
      type: "approval_required" as const,
      title: `Freigabe erforderlich: ${params.title}`,
      body: `${params.instance.displayName} hat eine Aktion vorbereitet (Risiko: ${params.riskLevel}). Begründung: ${params.reasoning}`,
      href: "/app/approvals",
      sandbox: params.sandbox,
    };
    if (params.instance.responsibleUserId) {
      await notify({ ...payload, userId: params.instance.responsibleUserId });
      return;
    }
    // Ohne verantwortliche Person: alle Rollen mit Entscheidungsrecht.
    await notifyOrganization({
      ...payload,
      roles: ["owner", "admin", "manager", "member"],
    });
  } catch (err) {
    console.error("Freigabe-Benachrichtigung fehlgeschlagen:", err);
  }
}

/** Meldet einen fehlgeschlagenen Lauf; scheitert nie lautstark. */
async function notifyRunFailure(params: {
  organizationId: string;
  instance: typeof agentInstance.$inferSelect;
  sandbox: boolean;
  capabilityName: string;
  message: string;
}): Promise<void> {
  try {
    const { notify, notifyOrganization } = await import(
      "@/server/notifications/service"
    );
    const payload = {
      organizationId: params.organizationId,
      type: "agent_failed" as const,
      title: `${params.instance.displayName}: Lauf fehlgeschlagen`,
      body: `Fähigkeit "${params.capabilityName}" konnte nicht abgeschlossen werden. Grund: ${params.message}`,
      href: `/app/agents/${params.instance.id}`,
      sandbox: params.sandbox,
    };
    if (params.instance.responsibleUserId) {
      await notify({ ...payload, userId: params.instance.responsibleUserId });
    } else {
      await notifyOrganization({ ...payload, roles: ["owner", "admin"] });
    }
  } catch (err) {
    console.error("Fehler-Benachrichtigung fehlgeschlagen:", err);
  }
}

/** Anzahl offener Freigaben einer Organisation (für Badges/Overview). */
export async function countPendingApprovals(
  organizationId: string,
): Promise<number> {
  const [row] = await withOrg(organizationId, (tx) =>
    tx
      .select({ value: sql<number>`count(*)::int` })
      .from(approvalRequest)
      .where(eq(approvalRequest.status, "pending")),
  );
  return row?.value ?? 0;
}
