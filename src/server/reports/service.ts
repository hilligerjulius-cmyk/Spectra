import "server-only";
import { and, gte, sql } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import {
  agentInstance,
  agentRun,
  approvalRequest,
  task,
} from "@/server/db/schema";
import { getAgentDefinition } from "@/server/agents/catalog";

/**
 * Berichte aus tatsächlichen Laufdaten.
 *
 * Grundsatz (Spec §4.3): keine erfundenen Kennzahlen. Alles hier stammt aus
 * `agent_run`, `approval_request` und `task`. Wo eine Zahl nur geschätzt
 * werden kann — Zeitersparnis — ist sie als Schätzung gekennzeichnet und ihre
 * Herleitung dokumentiert (siehe MINUTES_SAVED_PER_RUN).
 *
 * Sandbox-Läufe fließen bewusst nicht in die Berichte ein: Sie messen Tests,
 * nicht die geleistete Arbeit.
 */

/**
 * Geschätzte eingesparte Minuten je erfolgreichem Lauf, nach Fähigkeits-Typ.
 * Bewusst konservative Annahme (dokumentiert, im UI als Schätzung markiert):
 * Grundlage ist der Aufwand, den ein Mensch für dieselbe Aufgabe hätte.
 * Diese Werte sind keine Messung — sie sind eine Annahme.
 */
export const MINUTES_SAVED_PER_RUN: Record<string, number> = {
  extract: 8,
  classify: 3,
  draft: 12,
  summarize: 6,
  report: 20,
  checklist: 10,
  qa: 5,
  monitor: 2,
  analysis: 2,
};

export interface PeriodStats {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  waitingRuns: number;
  cancelledRuns: number;
  successRate: number;
  totalCostDeciCents: number;
  averageDurationMs: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
}

export interface AgentPerformance {
  instanceId: string;
  slug: string;
  displayName: string;
  roleTitle: string;
  department: string;
  runs: number;
  completed: number;
  failed: number;
  successRate: number;
  costDeciCents: number;
  averageDurationMs: number;
  estimatedMinutesSaved: number;
  lastRunAt: string | null;
}

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  expired: number;
  cancelled: number;
  approvalRate: number;
  /** Median-Bearbeitungsdauer in Minuten (null = keine Entscheidung erfasst). */
  medianDecisionMinutes: number | null;
}

export interface TaskStats {
  total: number;
  open: number;
  done: number;
  overdue: number;
  byAgent: number;
}

export interface ReportData {
  periodDays: number;
  since: string;
  stats: PeriodStats;
  agents: AgentPerformance[];
  approvals: ApprovalStats;
  tasks: TaskStats;
  dailyRuns: { date: string; completed: number; failed: number }[];
  /** Summe der Schätzwerte — ausdrücklich als Schätzung zu kennzeichnen. */
  estimatedMinutesSaved: number;
  /** Läuft die Plattform ohne echten KI-Provider? Dann sind Kosten = 0. */
  costsAreZeroBecauseScripted: boolean;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!;
}

export async function loadReport(
  organizationId: string,
  periodDays = 30,
): Promise<ReportData> {
  const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  const { runs, instances, approvals, tasks } = await withOrg(
    organizationId,
    async (tx) => {
      const runs = await tx
        .select()
        .from(agentRun)
        .where(
          and(
            gte(agentRun.createdAt, since),
            sql`${agentRun.sandbox} = false`,
          ),
        );
      const instances = await tx.select().from(agentInstance);
      const approvals = await tx
        .select()
        .from(approvalRequest)
        .where(gte(approvalRequest.createdAt, since));
      const tasks = await tx.select().from(task);
      return { runs, instances, approvals, tasks };
    },
  );

  const completed = runs.filter((r) => r.status === "completed");
  const failed = runs.filter((r) => r.status === "failed");
  const waiting = runs.filter((r) => r.status === "waiting_approval");
  const cancelled = runs.filter((r) => r.status === "cancelled");
  const finished = completed.length + failed.length;

  const durations = runs
    .map((r) => r.durationMs)
    .filter((d): d is number => d !== null);

  const stats: PeriodStats = {
    totalRuns: runs.length,
    completedRuns: completed.length,
    failedRuns: failed.length,
    waitingRuns: waiting.length,
    cancelledRuns: cancelled.length,
    successRate: finished > 0 ? Math.round((completed.length / finished) * 100) : 0,
    totalCostDeciCents: runs.reduce((s, r) => s + r.costDeciCents, 0),
    averageDurationMs:
      durations.length > 0
        ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
        : 0,
    totalPromptTokens: runs.reduce((s, r) => s + r.promptTokens, 0),
    totalCompletionTokens: runs.reduce((s, r) => s + r.completionTokens, 0),
  };

  // Leistung je Agent — nur Agenten mit tatsächlichen Läufen im Zeitraum.
  const { classifyCapability } = await import(
    "@/server/agents/runtime/archetypes"
  );
  const agents: AgentPerformance[] = instances
    .map((instance) => {
      const own = runs.filter((r) => r.agentInstanceId === instance.id);
      const def = getAgentDefinition(instance.definitionSlug);
      const ownCompleted = own.filter((r) => r.status === "completed");
      const ownFailed = own.filter((r) => r.status === "failed");
      const ownFinished = ownCompleted.length + ownFailed.length;
      const ownDurations = own
        .map((r) => r.durationMs)
        .filter((d): d is number => d !== null);
      const minutesSaved = ownCompleted.reduce(
        (sum, r) =>
          sum + (MINUTES_SAVED_PER_RUN[classifyCapability(r.capabilityKey)] ?? 2),
        0,
      );
      const lastRun = own
        .map((r) => r.createdAt)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        instanceId: instance.id,
        slug: instance.definitionSlug,
        displayName: instance.displayName,
        roleTitle: def?.roleTitle ?? instance.definitionSlug,
        department: def?.department ?? "unbekannt",
        runs: own.length,
        completed: ownCompleted.length,
        failed: ownFailed.length,
        successRate:
          ownFinished > 0
            ? Math.round((ownCompleted.length / ownFinished) * 100)
            : 0,
        costDeciCents: own.reduce((s, r) => s + r.costDeciCents, 0),
        averageDurationMs:
          ownDurations.length > 0
            ? Math.round(
                ownDurations.reduce((s, d) => s + d, 0) / ownDurations.length,
              )
            : 0,
        estimatedMinutesSaved: minutesSaved,
        lastRunAt: lastRun?.toISOString() ?? null,
      };
    })
    .filter((a) => a.runs > 0)
    .sort((a, b) => b.runs - a.runs);

  const decided = approvals.filter(
    (a) => a.decidedAt !== null && a.status !== "pending",
  );
  const approvalStats: ApprovalStats = {
    total: approvals.length,
    pending: approvals.filter((a) => a.status === "pending").length,
    approved: approvals.filter((a) => a.status === "approved").length,
    rejected: approvals.filter((a) => a.status === "rejected").length,
    expired: approvals.filter((a) => a.status === "expired").length,
    cancelled: approvals.filter((a) => a.status === "cancelled").length,
    approvalRate:
      decided.length > 0
        ? Math.round(
            (approvals.filter((a) => a.status === "approved").length /
              decided.length) *
              100,
          )
        : 0,
    medianDecisionMinutes: median(
      decided.map((a) =>
        Math.round(
          (a.decidedAt!.getTime() - a.createdAt.getTime()) / 60_000,
        ),
      ),
    ),
  };

  const now = Date.now();
  const taskStats: TaskStats = {
    total: tasks.length,
    open: tasks.filter((t) => t.status === "open" || t.status === "in_progress")
      .length,
    done: tasks.filter((t) => t.status === "done").length,
    overdue: tasks.filter(
      (t) =>
        (t.status === "open" || t.status === "in_progress") &&
        t.dueAt !== null &&
        t.dueAt.getTime() < now,
    ).length,
    byAgent: tasks.filter((t) => t.createdByType === "agent").length,
  };

  // Tageswerte für die Verlaufsgrafik — lückenlos, damit ruhige Tage sichtbar sind.
  const dailyRuns: { date: string; completed: number; failed: number }[] = [];
  for (let i = periodDays - 1; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().slice(0, 10);
    const ofDay = runs.filter(
      (r) => r.createdAt.toISOString().slice(0, 10) === key,
    );
    dailyRuns.push({
      date: key,
      completed: ofDay.filter((r) => r.status === "completed").length,
      failed: ofDay.filter((r) => r.status === "failed").length,
    });
  }

  return {
    periodDays,
    since: since.toISOString(),
    stats,
    agents,
    approvals: approvalStats,
    tasks: taskStats,
    dailyRuns,
    estimatedMinutesSaved: agents.reduce(
      (s, a) => s + a.estimatedMinutesSaved,
      0,
    ),
    costsAreZeroBecauseScripted:
      stats.totalRuns > 0 && stats.totalCostDeciCents === 0,
  };
}

/* -------------------------------------------------------------------------- */
/* Ziele & KPIs                                                               */
/* -------------------------------------------------------------------------- */

export interface AgentGoal {
  instanceId: string;
  displayName: string;
  roleTitle: string;
  slug: string;
  /** KPI-Definitionen aus dem Katalog mit tatsächlich gemessenen Werten. */
  kpis: {
    key: string;
    label: string;
    unit: string;
    /** null = für diese Kennzahl liegen noch keine Daten vor. */
    value: number | null;
    /** Woraus der Wert stammt — oder warum er fehlt. */
    basis: string;
  }[];
}

/**
 * Ordnet den Katalog-KPIs tatsächliche Messwerte zu.
 * Kennzahlen, für die es keine belastbare Datengrundlage gibt, bleiben
 * bewusst `null` mit einer Begründung — statt eine Zahl zu erfinden.
 */
export async function loadGoals(
  organizationId: string,
  periodDays = 30,
): Promise<AgentGoal[]> {
  const report = await loadReport(organizationId, periodDays);
  const byInstance = new Map(report.agents.map((a) => [a.instanceId, a]));

  const instances = await withOrg(organizationId, (tx) =>
    tx.select().from(agentInstance),
  );

  return instances.flatMap((instance) => {
    const def = getAgentDefinition(instance.definitionSlug);
    if (!def) return [];
    const perf = byInstance.get(instance.id);

    return [
      {
        instanceId: instance.id,
        displayName: instance.displayName,
        roleTitle: def.roleTitle,
        slug: def.slug,
        kpis: def.kpis.map((kpi) => {
          // Direkt messbare Kennzahlen aus den Laufdaten
          if (/lauf|läufe|runs|verarbeitet|bearbeitet|anzahl/i.test(kpi.label)) {
            return {
              ...kpi,
              value: perf?.completed ?? 0,
              basis: "Abgeschlossene Läufe im Zeitraum",
            };
          }
          if (/quote|rate|genauigkeit|erfolg/i.test(kpi.label)) {
            return {
              ...kpi,
              value: perf ? perf.successRate : null,
              basis: perf
                ? "Anteil abgeschlossener an beendeten Läufen"
                : "Noch keine Läufe im Zeitraum",
            };
          }
          if (/zeit|dauer|minuten|stunden/i.test(kpi.label)) {
            return {
              ...kpi,
              value: perf ? perf.estimatedMinutesSaved : null,
              basis: perf
                ? "Schätzung je Fähigkeitstyp — keine Messung"
                : "Noch keine Läufe im Zeitraum",
            };
          }
          return {
            ...kpi,
            value: null,
            basis:
              "Für diese Kennzahl liegt noch keine belastbare Datenquelle vor. Sie wird nicht geschätzt.",
          };
        }),
      },
    ];
  });
}
