import "server-only";
import { count, desc, eq, sql } from "drizzle-orm";
import { adminDb } from "@/server/db/client";
import {
  agentInstance,
  agentRun,
  auditLog,
  featureFlag,
  member,
  organization,
  subscription,
  supportAccessLog,
  usageRecord,
} from "@/server/db/schema";
import { PLAN_SEEDS } from "@/server/billing/plans";
import { DEFAULT_TIER_PRICES_CENTS } from "@/server/agents/catalog";

/**
 * Datenzugriffe des Plattformbereichs.
 *
 * Alle Abfragen laufen über die Owner-Verbindung, weil sie bewusst
 * organisationsübergreifend sind. Der Zugriff ist ausschließlich hinter
 * `requirePlatformAccess()` erreichbar; Einblicke in Kundendaten werden
 * zusätzlich über `logSupportAccess()` protokolliert.
 */

export interface OrganizationOverview {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  agentCount: number;
  activeAgentCount: number;
  runCount30d: number;
  planKey: string | null;
  subscriptionStatus: string | null;
}

export async function listOrganizations(): Promise<OrganizationOverview[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const orgs = await adminDb
    .select()
    .from(organization)
    .orderBy(desc(organization.createdAt))
    .limit(200);

  // Aggregierte Kennzahlen — bewusst nur Zählungen, keine Inhalte.
  const memberCounts = await adminDb
    .select({ organizationId: member.organizationId, value: count() })
    .from(member)
    .groupBy(member.organizationId);
  const agentCounts = await adminDb
    .select({
      organizationId: agentInstance.organizationId,
      total: count(),
      active: sql<number>`count(*) filter (where ${agentInstance.status} = 'active')::int`,
    })
    .from(agentInstance)
    .groupBy(agentInstance.organizationId);
  const runCounts = await adminDb
    .select({ organizationId: agentRun.organizationId, value: count() })
    .from(agentRun)
    .where(sql`${agentRun.createdAt} >= ${since}`)
    .groupBy(agentRun.organizationId);
  const subs = await adminDb.select().from(subscription);

  const memberMap = new Map(memberCounts.map((m) => [m.organizationId, m.value]));
  const agentMap = new Map(agentCounts.map((a) => [a.organizationId, a]));
  const runMap = new Map(runCounts.map((r) => [r.organizationId, r.value]));
  const subMap = new Map(subs.map((s) => [s.organizationId, s]));

  return orgs.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt.toISOString(),
    memberCount: memberMap.get(org.id) ?? 0,
    agentCount: agentMap.get(org.id)?.total ?? 0,
    activeAgentCount: agentMap.get(org.id)?.active ?? 0,
    runCount30d: runMap.get(org.id) ?? 0,
    planKey: subMap.get(org.id)?.planKey ?? null,
    subscriptionStatus: subMap.get(org.id)?.status ?? null,
  }));
}

export interface PlatformStats {
  organizations: number;
  users: number;
  agentInstances: number;
  runs30d: number;
  failedRuns30d: number;
  totalCostDeciCents30d: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
}

export async function loadPlatformStats(): Promise<PlatformStats> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [orgs] = await adminDb
    .select({ value: count() })
    .from(organization);
  const [members] = await adminDb
    .select({ value: sql<number>`count(distinct ${member.userId})::int` })
    .from(member);
  const [instances] = await adminDb
    .select({ value: count() })
    .from(agentInstance);
  const runs = await adminDb
    .select({
      total: count(),
      failed: sql<number>`count(*) filter (where ${agentRun.status} = 'failed')::int`,
      cost: sql<number>`coalesce(sum(${agentRun.costDeciCents}), 0)::int`,
    })
    .from(agentRun)
    .where(sql`${agentRun.createdAt} >= ${since}`);
  const subs = await adminDb
    .select({ status: subscription.status, value: count() })
    .from(subscription)
    .groupBy(subscription.status);

  return {
    organizations: orgs?.value ?? 0,
    users: members?.value ?? 0,
    agentInstances: instances?.value ?? 0,
    runs30d: runs[0]?.total ?? 0,
    failedRuns30d: runs[0]?.failed ?? 0,
    totalCostDeciCents30d: runs[0]?.cost ?? 0,
    activeSubscriptions:
      subs.find((s) => s.status === "active")?.value ?? 0,
    trialSubscriptions:
      subs.find((s) => s.status === "trialing")?.value ?? 0,
  };
}

/** Audit-Einträge organisationsübergreifend durchsuchen. */
export async function searchAuditLog(params: {
  organizationId?: string;
  action?: string;
  limit?: number;
}) {
  const conditions = [];
  if (params.organizationId) {
    conditions.push(eq(auditLog.organizationId, params.organizationId));
  }
  if (params.action) {
    conditions.push(sql`${auditLog.action} ilike ${`%${params.action}%`}`);
  }

  return adminDb
    .select({
      id: auditLog.id,
      organizationId: auditLog.organizationId,
      organizationName: organization.name,
      actorType: auditLog.actorType,
      actorLabel: auditLog.actorLabel,
      action: auditLog.action,
      summary: auditLog.summary,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .innerJoin(organization, eq(auditLog.organizationId, organization.id))
    .where(conditions.length > 0 ? sql.join(conditions, sql` and `) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(Math.min(params.limit ?? 100, 300));
}

/** Bisherige Support-Zugriffe — für Nachvollziehbarkeit im Betrieb. */
export async function listSupportAccess(limit = 100) {
  return adminDb
    .select({
      id: supportAccessLog.id,
      organizationId: supportAccessLog.organizationId,
      organizationName: organization.name,
      userLabel: supportAccessLog.userLabel,
      reason: supportAccessLog.reason,
      scope: supportAccessLog.scope,
      createdAt: supportAccessLog.createdAt,
    })
    .from(supportAccessLog)
    .innerJoin(organization, eq(supportAccessLog.organizationId, organization.id))
    .orderBy(desc(supportAccessLog.createdAt))
    .limit(Math.min(limit, 300));
}

/* -------------------------------------------------------------------------- */
/* Preise & Pläne                                                             */
/* -------------------------------------------------------------------------- */

export interface PriceOverviewRow {
  scope: "tier" | "department" | "agent";
  targetKey: string;
  label: string;
  defaultCents: number;
  overrideCents: number | null;
}

export async function loadPriceOverview(): Promise<PriceOverviewRow[]> {
  const { priceOverride } = await import("@/server/db/schema");
  const { departments } = await import("@/server/agents/catalog");
  const overrides = await adminDb.select().from(priceOverride);
  const map = new Map(
    overrides.map((o) => [`${o.scope}:${o.targetKey}`, o.monthlyPriceCents]),
  );

  const tierLabels: Record<string, string> = {
    simple: "Preisstufe: Einfach",
    advanced: "Preisstufe: Fortgeschritten",
    complex: "Preisstufe: Komplex",
    chief: "Preisstufe: Chief of Staff",
  };

  const rows: PriceOverviewRow[] = Object.entries(
    DEFAULT_TIER_PRICES_CENTS,
  ).map(([tier, cents]) => ({
    scope: "tier" as const,
    targetKey: tier,
    label: tierLabels[tier] ?? tier,
    defaultCents: cents,
    overrideCents: map.get(`tier:${tier}`) ?? null,
  }));

  for (const dept of Object.values(departments)) {
    if (!dept.bundlePriceCents) continue;
    rows.push({
      scope: "department",
      targetKey: dept.slug,
      label: `Paket: ${dept.name}`,
      defaultCents: dept.bundlePriceCents,
      overrideCents: map.get(`department:${dept.slug}`) ?? null,
    });
  }

  return rows;
}

export interface PlanOverviewRow {
  key: string;
  name: string;
  monthlyPriceCents: number;
  yearlyPricePerMonthCents: number;
  includedAgentSeats: number;
  includedRuns: number;
  active: boolean;
  /** Weicht der gespeicherte Preis von der Auslieferung ab? */
  differsFromSeed: boolean;
}

export async function loadPlanOverview(): Promise<PlanOverviewRow[]> {
  const { plan } = await import("@/server/db/schema");
  const { ensurePlansSeeded } = await import("@/server/billing/service");
  await ensurePlansSeeded();
  const rows = await adminDb.select().from(plan).orderBy(plan.sortOrder);
  return rows.map((row) => {
    const seed = PLAN_SEEDS.find((p) => p.key === row.key);
    return {
      key: row.key,
      name: row.name,
      monthlyPriceCents: row.monthlyPriceCents,
      yearlyPricePerMonthCents: row.yearlyPricePerMonthCents,
      includedAgentSeats: row.includedAgentSeats,
      includedRuns: row.includedRuns,
      active: row.active,
      differsFromSeed: seed
        ? seed.monthlyPriceCents !== row.monthlyPriceCents ||
          seed.yearlyPricePerMonthCents !== row.yearlyPricePerMonthCents
        : true,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Feature Flags                                                              */
/* -------------------------------------------------------------------------- */

/** Auslieferungs-Schalter; werden beim ersten Aufruf angelegt. */
export const FEATURE_FLAG_SEEDS = [
  {
    key: "scheduled_runs",
    label: "Zeitgesteuerte Läufe",
    description:
      "Agenten nach Zeitplan starten. Erfordert den pg-boss-Worker (siehe TODO.md) — ohne ihn bleibt der Schalter wirkungslos.",
  },
  {
    key: "bulk_approvals",
    label: "Sammelfreigaben",
    description:
      "Mehrere gleichartige, risikoarme Aktionen gemeinsam freigeben.",
  },
  {
    key: "advanced_reports",
    label: "Erweiterte Berichte",
    description: "Zusätzliche Auswertungen und Exporte in den Berichten.",
  },
] as const;

export async function ensureFlagsSeeded(): Promise<void> {
  const existing = await adminDb.select({ key: featureFlag.key }).from(featureFlag);
  const known = new Set(existing.map((f) => f.key));
  const missing = FEATURE_FLAG_SEEDS.filter((f) => !known.has(f.key));
  if (missing.length === 0) return;
  await adminDb
    .insert(featureFlag)
    .values(missing.map((f) => ({ ...f, enabled: false })))
    .onConflictDoNothing();
}

export async function listFeatureFlags() {
  await ensureFlagsSeeded();
  return adminDb.select().from(featureFlag).orderBy(featureFlag.key);
}

/**
 * Prüft einen Schalter für eine Organisation.
 * Ist eine Organisationsliste hinterlegt, gilt der Schalter nur dort.
 */
export async function isFeatureEnabled(
  key: string,
  organizationId: string,
): Promise<boolean> {
  const [row] = await adminDb
    .select()
    .from(featureFlag)
    .where(eq(featureFlag.key, key));
  if (!row || !row.enabled) return false;
  if (row.organizationIds.length === 0) return true;
  return row.organizationIds.includes(organizationId);
}

/** Verbrauch je Organisation in der laufenden Periode. */
export async function loadUsageOverview() {
  const period = `${new Date().getUTCFullYear()}-${String(
    new Date().getUTCMonth() + 1,
  ).padStart(2, "0")}`;
  return adminDb
    .select({
      organizationId: usageRecord.organizationId,
      organizationName: organization.name,
      metric: usageRecord.metric,
      value: usageRecord.value,
    })
    .from(usageRecord)
    .innerJoin(organization, eq(usageRecord.organizationId, organization.id))
    .where(eq(usageRecord.period, period));
}
