import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/server/db/client";
import { adminDb } from "@/server/db/client";
import {
  agentInstance,
  auditLog,
  notification,
  task,
} from "@/server/db/schema";
import type { RiskLevel } from "@/server/agents/catalog";

/**
 * Tool-Registry der Agent-Runtime.
 * Jedes Tool hat ein validiertes Eingabeschema, eine Risikostufe und eine
 * echte Implementierung. Agenten dürfen ausschließlich Tools aufrufen, die
 * (a) in ihrer Instanz freigegeben und (b) von der aktiven Fähigkeit
 * benötigt werden — serverseitig durchgesetzt in der Engine.
 * Nicht implementierte Tools (externe Integrationen ohne Credentials) werfen
 * einen klaren Fehler statt Ergebnisse vorzutäuschen.
 */

export interface ToolContext {
  organizationId: string;
  instanceId: string;
  runId: string;
  sandbox: boolean;
  requestedByUserId: string | null;
}

export interface ToolResult {
  /** Kurze, sichere Zusammenfassung für die Timeline. */
  summary: string;
  data?: unknown;
  sources?: { title: string; ref: string }[];
}

export interface ToolDefinition {
  key: string;
  name: string;
  riskLevel: RiskLevel;
  /** Idempotente Tools dürfen bei Retries erneut ausgeführt werden. */
  idempotent: boolean;
  inputSchema: z.ZodType;
  execute(ctx: ToolContext, input: unknown): Promise<ToolResult>;
}

const registry = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  registry.set(tool.key, tool);
}

export function getTool(key: string): ToolDefinition | undefined {
  return registry.get(key);
}

export function listRegisteredTools(): string[] {
  return [...registry.keys()];
}

/* ------------------------------------------------------------------------- */
/* Kern-Tools (Plattformdaten — ohne externe Integrationen lauffähig)        */
/* ------------------------------------------------------------------------- */

registerTool({
  key: "tasks.read",
  name: "Aufgaben lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    status: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      status?: string[];
      limit: number;
    };
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(task)
        .where(
          input.status && input.status.length > 0
            ? inArray(task.status, input.status)
            : undefined,
        )
        .orderBy(desc(task.createdAt))
        .limit(input.limit),
    );
    return {
      summary: `${rows.length} Aufgaben gelesen`,
      data: rows.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueAt: t.dueAt?.toISOString() ?? null,
      })),
    };
  },
});

registerTool({
  key: "tasks.write",
  name: "Aufgabe erstellen",
  riskLevel: "low",
  idempotent: false,
  inputSchema: z.object({
    title: z.string().min(3).max(200),
    description: z.string().max(2000).nullable().optional(),
    dueAt: z.string().nullable().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    assigneeUserId: z.string().nullable().optional(),
    source: z.record(z.string(), z.unknown()).optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      title: string;
      description?: string | null;
      dueAt?: string | null;
      priority: "low" | "normal" | "high" | "urgent";
      assigneeUserId?: string | null;
      source?: Record<string, unknown>;
    };
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    const inserted = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(task)
        .values({
          organizationId: ctx.organizationId,
          title: ctx.sandbox ? `[SANDBOX] ${input.title}` : input.title,
          description: input.description ?? null,
          dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
          priority: input.priority,
          assigneeUserId: input.assigneeUserId ?? ctx.requestedByUserId,
          agentInstanceId: ctx.instanceId,
          createdByType: "agent",
          createdById: ctx.instanceId,
          source: { ...(input.source ?? {}), sandbox: ctx.sandbox, runId: ctx.runId },
        })
        .returning({ id: task.id, title: task.title }),
    );
    return {
      summary: `Aufgabe "${inserted[0]!.title}" erstellt`,
      data: { taskId: inserted[0]!.id },
    };
  },
});

registerTool({
  key: "notify.send",
  name: "Benachrichtigung senden",
  riskLevel: "low",
  idempotent: false,
  inputSchema: z.object({
    userId: z.string().nullable().optional(),
    type: z.string().default("info"),
    title: z.string().min(3).max(200),
    body: z.string().max(2000).nullable().optional(),
    href: z.string().max(300).nullable().optional(),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as {
      userId?: string | null;
      type: string;
      title: string;
      body?: string | null;
      href?: string | null;
    };
    // Empfänger: explizit angegeben oder verantwortliche Person der Instanz
    let userId = input.userId ?? ctx.requestedByUserId;
    if (!userId) {
      const [row] = await adminDb
        .select({ responsibleUserId: agentInstance.responsibleUserId })
        .from(agentInstance)
        .where(eq(agentInstance.id, ctx.instanceId));
      userId = row?.responsibleUserId ?? null;
    }
    if (!userId) {
      return { summary: "Keine Empfängerin gefunden — Benachrichtigung übersprungen" };
    }
    await withOrg(ctx.organizationId, (tx) =>
      tx.insert(notification).values({
        organizationId: ctx.organizationId,
        userId: userId,
        type: input.type,
        title: ctx.sandbox ? `[SANDBOX] ${input.title}` : input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      }),
    );
    return { summary: `Benachrichtigung "${input.title}" zugestellt` };
  },
});

registerTool({
  key: "activity.read",
  name: "Aktivitätsprotokoll lesen",
  riskLevel: "low",
  idempotent: true,
  inputSchema: z.object({
    limit: z.number().int().min(1).max(50).default(20),
  }),
  async execute(ctx, rawInput) {
    const input = this.inputSchema.parse(rawInput) as { limit: number };
    const rows = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select({
          action: auditLog.action,
          summary: auditLog.summary,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(input.limit),
    );
    return {
      summary: `${rows.length} Aktivitätseinträge gelesen`,
      data: rows,
    };
  },
});

/* ------------------------------------------------------------------------- */
/* Platzhalter: jedes im Katalog referenzierte, aber noch nicht implementierte */
/* Tool wirft einen klaren Fehler statt Ergebnisse vorzutäuschen (Spec §4.5).  */
/* ------------------------------------------------------------------------- */

/**
 * Registriert für alle im Agentenkatalog referenzierten Tool-Schlüssel, die
 * keine echte Implementierung haben, einen Platzhalter. Wird nach dem Laden
 * der echten Tools aufgerufen, damit implementierte Tools Vorrang haben.
 */
export function registerCatalogPlaceholders(catalogToolKeys: string[]): void {
  for (const key of catalogToolKeys) {
    if (registry.has(key)) continue;
    registerTool({
      key,
      name: key,
      riskLevel: "medium",
      idempotent: true,
      inputSchema: z.unknown(),
      async execute() {
        throw new Error(
          `Tool "${key}" ist noch nicht verfügbar: Die zugehörige Integration ist nicht verbunden oder noch nicht implementiert. Siehe Integrations-Seite.`,
        );
      },
    });
  }
}

/** Prüft, ob ein Tool eine echte Implementierung besitzt (kein Platzhalter). */
export function isToolImplemented(key: string): boolean {
  return implementedTools.has(key);
}

const implementedTools = new Set(registry.keys());

/** Markiert nachträglich registrierte Tools als echt implementiert. */
export function markImplemented(keys: string[]): void {
  for (const key of keys) implementedTools.add(key);
}
