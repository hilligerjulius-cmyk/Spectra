import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { adminDb, withOrg } from "@/server/db/client";
import {
  agentInstance,
  invoiceRecord,
  plan,
  priceOverride,
  subscription,
  usageRecord,
} from "@/server/db/schema";
import { getAgentDefinition } from "@/server/agents/catalog";
import { computeTeamPricing } from "./pricing";
import { PLAN_SEEDS, COUPONS } from "./plans";
import { getBillingProvider, type CheckoutRequest } from "./providers";
import { env, providerStatus } from "@/lib/env";

/**
 * Billing-Service: sämtliche Preisbildung erfolgt hier serverseitig.
 * Der Client sendet nie Preise, sondern nur Auswahl-Schlüssel.
 */

export type PlanRow = typeof plan.$inferSelect;
export type SubscriptionRow = typeof subscription.$inferSelect;

/** Legt die Standard-Pläne an, falls die Tabelle leer ist (idempotent). */
export async function ensurePlansSeeded(): Promise<void> {
  const existing = await adminDb.select({ key: plan.key }).from(plan);
  const existingKeys = new Set(existing.map((p) => p.key));
  const missing = PLAN_SEEDS.filter((p) => !existingKeys.has(p.key));
  if (missing.length === 0) return;
  await adminDb.insert(plan).values(missing).onConflictDoNothing();
}

export async function listPlans(): Promise<PlanRow[]> {
  await ensurePlansSeeded();
  return adminDb
    .select()
    .from(plan)
    .where(eq(plan.active, true))
    .orderBy(plan.sortOrder);
}

export async function getPlan(key: string): Promise<PlanRow | null> {
  await ensurePlansSeeded();
  const [row] = await adminDb.select().from(plan).where(eq(plan.key, key));
  return row ?? null;
}

/** Aktueller Monat als Abrechnungsperiode (YYYY-MM). */
export function currentPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getSubscription(
  organizationId: string,
): Promise<SubscriptionRow | null> {
  const [row] = await withOrg(organizationId, (tx) =>
    tx.select().from(subscription).where(eq(subscription.organizationId, organizationId)),
  );
  return row ?? null;
}

/**
 * Startet eine Testphase, falls die Organisation noch kein Abo hat.
 * 14 Tage Starter-Plan, ohne Zahlungsmittel.
 */
export async function ensureSubscription(
  organizationId: string,
): Promise<SubscriptionRow> {
  const existing = await getSubscription(organizationId);
  if (existing) return existing;
  await ensurePlansSeeded();
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const [row] = await withOrg(organizationId, (tx) =>
    tx
      .insert(subscription)
      .values({
        organizationId,
        planKey: "starter",
        status: "trialing",
        billingInterval: "monthly",
        provider: providerStatus.stripe ? "stripe" : "mock",
        trialEndsAt: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      })
      .onConflictDoNothing()
      .returning(),
  );
  return row ?? (await getSubscription(organizationId))!;
}

/** Preis-Overrides laden (Admin kann Katalogpreise überschreiben). */
async function loadOverrides(): Promise<Map<string, number>> {
  const rows = await adminDb.select().from(priceOverride);
  return new Map(
    rows.map((r) => [`${r.scope}:${r.targetKey}`, r.monthlyPriceCents]),
  );
}

export interface BillingLine {
  key: string;
  label: string;
  monthlyCents: number;
}

export interface BillingSummary {
  planKey: string;
  planName: string;
  billingInterval: "monthly" | "yearly";
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  provider: string;
  providerIsReal: boolean;
  /** Grundgebühr für das gewählte Intervall (pro Monat). */
  platformFeeCents: number;
  agentLines: BillingLine[];
  bundleLines: BillingLine[];
  includedAgentSeats: number;
  billableAgentCount: number;
  agentSubtotalCents: number;
  volumeDiscountCents: number;
  volumeDiscountPercent: number;
  couponCode: string | null;
  couponPercent: number;
  couponDiscountCents: number;
  totalMonthlyCents: number;
  usage: {
    runs: { used: number; included: number };
    aiCostDeciCents: { used: number; included: number };
  };
  limitReached: boolean;
  limitWarning: boolean;
}

/**
 * Berechnet die vollständige Abrechnungsübersicht einer Organisation.
 * Reihenfolge: Plattformgebühr + Agentenkosten (Pakete/Mengenrabatt)
 * − enthaltene Plätze − Gutschein.
 */
export async function computeBillingSummary(
  organizationId: string,
): Promise<BillingSummary> {
  const [sub, overrides] = await Promise.all([
    ensureSubscription(organizationId),
    loadOverrides(),
  ]);
  const planRow = (await getPlan(sub.planKey)) ?? (await getPlan("starter"))!;

  const instances = await withOrg(organizationId, (tx) =>
    tx.select().from(agentInstance),
  );
  // Nur nicht-deaktivierte Agenten sind abrechnungsrelevant
  const billable = instances.filter((i) => i.status !== "disabled");
  const slugs = billable.map((i) => i.definitionSlug);

  const teamPricing = computeTeamPricing(slugs);

  // Admin-Overrides auf Einzelagenten anwenden
  const agentLines: BillingLine[] = teamPricing.items.map((item) => {
    const def = getAgentDefinition(item.slug);
    const override =
      overrides.get(`agent:${item.slug}`) ??
      (def ? overrides.get(`tier:${def.priceTier}`) : undefined);
    return {
      key: item.slug,
      label: item.name,
      monthlyCents: override ?? item.monthlyCents,
    };
  });
  const bundleLines: BillingLine[] = teamPricing.bundles.map((b) => ({
    key: b.department,
    label: `${b.name} (Paket)`,
    monthlyCents: overrides.get(`department:${b.department}`) ?? b.bundleCents,
  }));

  // Enthaltene Agenten-Plätze: die günstigsten Einzelagenten werden gutgeschrieben
  const sortedByPrice = [...agentLines].sort(
    (a, b) => a.monthlyCents - b.monthlyCents,
  );
  const freeSeats = Math.min(planRow.includedAgentSeats, sortedByPrice.length);
  const includedCredit = sortedByPrice
    .slice(0, freeSeats)
    .reduce((sum, l) => sum + l.monthlyCents, 0);

  const agentSum = agentLines.reduce((s, l) => s + l.monthlyCents, 0);
  const bundleSum = bundleLines.reduce((s, l) => s + l.monthlyCents, 0);

  // Mengenrabatt auf Einzelagenten (nach Abzug freier Plätze)
  const chargeableAgentSum = Math.max(agentSum - includedCredit, 0);
  const discountPercent = teamPricing.volumeDiscountPercent;
  const volumeDiscountCents = Math.round(
    (chargeableAgentSum * discountPercent) / 100,
  );

  const platformFeeCents =
    sub.billingInterval === "yearly"
      ? planRow.yearlyPricePerMonthCents
      : planRow.monthlyPriceCents;

  const beforeCoupon =
    platformFeeCents + chargeableAgentSum - volumeDiscountCents + bundleSum;
  const couponPercent = sub.discountPercent;
  const couponDiscountCents = Math.round((beforeCoupon * couponPercent) / 100);
  const totalMonthlyCents = Math.max(beforeCoupon - couponDiscountCents, 0);

  const period = currentPeriod();
  const usageRows = await withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(usageRecord)
      .where(eq(usageRecord.period, period)),
  );
  const runs =
    usageRows.find((u) => u.metric === "agent_run")?.value ?? 0;
  const aiCost = usageRows.find((u) => u.metric === "ai_cost")?.value ?? 0;

  const runRatio = planRow.includedRuns > 0 ? runs / planRow.includedRuns : 0;
  const costRatio =
    planRow.includedAiCostDeciCents > 0
      ? aiCost / planRow.includedAiCostDeciCents
      : 0;
  const maxRatio = Math.max(runRatio, costRatio);

  return {
    planKey: planRow.key,
    planName: planRow.name,
    billingInterval: sub.billingInterval as "monthly" | "yearly",
    status: sub.status,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    provider: sub.provider,
    providerIsReal: sub.provider === "stripe" && providerStatus.stripe,
    platformFeeCents,
    agentLines,
    bundleLines,
    includedAgentSeats: planRow.includedAgentSeats,
    billableAgentCount: billable.length,
    agentSubtotalCents: agentSum + bundleSum,
    volumeDiscountCents,
    volumeDiscountPercent: discountPercent,
    couponCode: sub.couponCode,
    couponPercent,
    couponDiscountCents,
    totalMonthlyCents,
    usage: {
      runs: { used: runs, included: planRow.includedRuns },
      aiCostDeciCents: {
        used: aiCost,
        included: planRow.includedAiCostDeciCents,
      },
    },
    limitReached: maxRatio >= 1,
    limitWarning: maxRatio >= 0.8 && maxRatio < 1,
  };
}

/** Verbrauch erhöhen (wird von der Runtime nach jedem Lauf aufgerufen). */
export async function recordUsage(
  organizationId: string,
  metric: "agent_run" | "ai_cost",
  value: number,
): Promise<void> {
  if (value <= 0) return;
  const period = currentPeriod();
  await withOrg(organizationId, (tx) =>
    tx
      .insert(usageRecord)
      .values({ organizationId, period, metric, value })
      .onConflictDoUpdate({
        target: [
          usageRecord.organizationId,
          usageRecord.period,
          usageRecord.metric,
        ],
        set: { value: sql`${usageRecord.value} + ${value}` },
      }),
  );
}

export interface UsageCheck {
  allowed: boolean;
  reason?: string;
  warning?: string;
}

/**
 * Prüft vor einem Agentenlauf, ob Kontingente noch reichen.
 * Sandbox-Testläufe zählen nicht gegen das Kontingent.
 */
export async function checkUsageAllowance(
  organizationId: string,
  options: { sandbox?: boolean } = {},
): Promise<UsageCheck> {
  if (options.sandbox) return { allowed: true };
  const summary = await computeBillingSummary(organizationId);
  if (summary.status === "canceled") {
    return {
      allowed: false,
      reason:
        "Das Abonnement wurde gekündigt. Bitte reaktivieren Sie es, um Agentenläufe auszuführen.",
    };
  }
  if (summary.usage.runs.used >= summary.usage.runs.included) {
    return {
      allowed: false,
      reason: `Das monatliche Kontingent von ${summary.usage.runs.included} Agentenläufen ist ausgeschöpft. Bitte upgraden Sie den Plan oder warten Sie auf die nächste Periode.`,
    };
  }
  if (
    summary.usage.aiCostDeciCents.used >= summary.usage.aiCostDeciCents.included
  ) {
    return {
      allowed: false,
      reason: `Das monatliche KI-Kostenlimit von ${(summary.usage.aiCostDeciCents.included / 1000).toFixed(2)} € ist erreicht. Bitte upgraden Sie den Plan.`,
    };
  }
  if (summary.limitWarning) {
    return {
      allowed: true,
      warning:
        "Mehr als 80 % des monatlichen Kontingents sind verbraucht. Bei Erreichen der Grenze stoppen die Agenten.",
    };
  }
  return { allowed: true };
}

export async function listInvoices(organizationId: string) {
  return withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(invoiceRecord)
      .orderBy(desc(invoiceRecord.issuedAt))
      .limit(24),
  );
}

/** Gutschein anwenden (serverseitig validiert). */
export function resolveCoupon(code: string) {
  const normalized = code.trim().toUpperCase();
  return COUPONS[normalized]
    ? { code: normalized, ...COUPONS[normalized]! }
    : null;
}

/* ------------------------------------------------------------------ */
/* Abo-Lebenszyklus (Provider-gestützt)                                */
/* ------------------------------------------------------------------ */

/** Baut die Provider-Anfrage aus dem serverseitig berechneten Ergebnis. */
async function buildCheckoutRequest(
  organizationId: string,
  organizationName: string,
  contactEmail: string,
  overrides: { planKey?: string; billingInterval?: "monthly" | "yearly" } = {},
): Promise<CheckoutRequest> {
  const summary = await computeBillingSummary(organizationId);
  return {
    organizationId,
    organizationName,
    planKey: overrides.planKey ?? summary.planKey,
    billingInterval: overrides.billingInterval ?? summary.billingInterval,
    monthlyTotalCents: summary.totalMonthlyCents,
    couponCode: summary.couponCode,
    returnUrl: `${env.APP_URL}/app/billing`,
    contactEmail,
  };
}

export interface PlanChangeResult {
  ok: boolean;
  message: string;
  /** Bei Stripe: URL zur Checkout-Seite, sonst null. */
  redirectUrl: string | null;
}

/**
 * Wechselt Plan und/oder Abrechnungsintervall.
 * Die Preisbildung erfolgt vollständig serverseitig; der Client übergibt
 * nur den Plan-Schlüssel.
 */
export async function changePlan(params: {
  organizationId: string;
  organizationName: string;
  contactEmail: string;
  planKey: string;
  billingInterval: "monthly" | "yearly";
}): Promise<PlanChangeResult> {
  const target = await getPlan(params.planKey);
  if (!target || !target.active) {
    return { ok: false, message: "Unbekannter Plan.", redirectUrl: null };
  }
  const sub = await ensureSubscription(params.organizationId);
  const provider = getBillingProvider();

  const request = await buildCheckoutRequest(
    params.organizationId,
    params.organizationName,
    params.contactEmail,
    { planKey: target.key, billingInterval: params.billingInterval },
  );
  const checkout = await provider.startCheckout(request);

  const now = new Date();
  const periodEnd = new Date(now);
  if (params.billingInterval === "yearly") {
    periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
  } else {
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
  }

  await withOrg(params.organizationId, (tx) =>
    tx
      .update(subscription)
      .set({
        planKey: target.key,
        billingInterval: params.billingInterval,
        provider: provider.key,
        // Bei Stripe bestätigt erst der Webhook die Aktivierung; bis dahin
        // bleibt der bisherige Status erhalten.
        status: provider.isReal ? sub.status : "active",
        externalCustomerId:
          checkout.externalCustomerId ?? sub.externalCustomerId,
        externalSubscriptionId:
          checkout.externalSubscriptionId ?? sub.externalSubscriptionId,
        currentPeriodStart: provider.isReal ? sub.currentPeriodStart : now,
        currentPeriodEnd: provider.isReal ? sub.currentPeriodEnd : periodEnd,
        cancelAtPeriodEnd: false,
      })
      .where(eq(subscription.organizationId, params.organizationId)),
  );

  return {
    ok: true,
    message: checkout.note,
    redirectUrl: checkout.redirectUrl,
  };
}

export async function applyCoupon(
  organizationId: string,
  code: string,
): Promise<{ ok: boolean; message: string }> {
  const coupon = resolveCoupon(code);
  if (!coupon) {
    return { ok: false, message: "Der Gutscheincode ist ungültig." };
  }
  await ensureSubscription(organizationId);
  await withOrg(organizationId, (tx) =>
    tx
      .update(subscription)
      .set({ couponCode: coupon.code, discountPercent: coupon.percent })
      .where(eq(subscription.organizationId, organizationId)),
  );
  return { ok: true, message: `${coupon.label} wurde angewendet.` };
}

export async function removeCoupon(organizationId: string): Promise<void> {
  await withOrg(organizationId, (tx) =>
    tx
      .update(subscription)
      .set({ couponCode: null, discountPercent: 0 })
      .where(eq(subscription.organizationId, organizationId)),
  );
}

export async function cancelSubscription(
  organizationId: string,
): Promise<{ ok: boolean; message: string }> {
  const sub = await ensureSubscription(organizationId);
  const provider = getBillingProvider();
  await provider.cancelAtPeriodEnd(sub.externalSubscriptionId);
  await withOrg(organizationId, (tx) =>
    tx
      .update(subscription)
      .set({ cancelAtPeriodEnd: true })
      .where(eq(subscription.organizationId, organizationId)),
  );
  return {
    ok: true,
    message: `Die Kündigung ist vorgemerkt. Der Zugang bleibt bis zum ${sub.currentPeriodEnd.toLocaleDateString("de-DE")} bestehen; danach werden keine Agentenläufe mehr ausgeführt.`,
  };
}

export async function resumeSubscription(
  organizationId: string,
): Promise<{ ok: boolean; message: string }> {
  const sub = await ensureSubscription(organizationId);
  const provider = getBillingProvider();
  await provider.resume(sub.externalSubscriptionId);
  await withOrg(organizationId, (tx) =>
    tx
      .update(subscription)
      .set({ cancelAtPeriodEnd: false })
      .where(eq(subscription.organizationId, organizationId)),
  );
  return { ok: true, message: "Die Kündigung wurde zurückgenommen." };
}

/**
 * Erzeugt eine Rechnung für die laufende Periode.
 * Rechnungen sind append-only (RLS-Policy) — eine bereits ausgestellte
 * Rechnung derselben Periode wird nicht erneut erzeugt.
 */
export async function issueInvoice(params: {
  organizationId: string;
  organizationName: string;
  contactEmail: string;
}): Promise<{ ok: boolean; message: string; invoiceNumber?: string }> {
  const sub = await ensureSubscription(params.organizationId);
  const summary = await computeBillingSummary(params.organizationId);
  const provider = getBillingProvider();

  const lineItems = [
    {
      label: `${summary.planName} (Plattformgebühr, ${summary.billingInterval === "yearly" ? "Jahreszahlung" : "monatlich"})`,
      amountCents: summary.platformFeeCents,
    },
    ...summary.agentLines.map((l) => ({
      label: `Digitaler Mitarbeiter: ${l.label}`,
      amountCents: l.monthlyCents,
    })),
    ...summary.bundleLines.map((l) => ({
      label: l.label,
      amountCents: l.monthlyCents,
    })),
  ];

  const request = await buildCheckoutRequest(
    params.organizationId,
    params.organizationName,
    params.contactEmail,
  );
  const draft = await provider.createInvoice(
    {
      ...request,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
      externalSubscriptionId: sub.externalSubscriptionId,
    },
    lineItems,
  );

  const existing = await withOrg(params.organizationId, (tx) =>
    tx
      .select({ id: invoiceRecord.id })
      .from(invoiceRecord)
      .where(eq(invoiceRecord.number, draft.number)),
  );
  if (existing.length > 0) {
    return {
      ok: false,
      message: `Für diese Periode existiert bereits die Rechnung ${draft.number}.`,
    };
  }

  await withOrg(params.organizationId, (tx) =>
    tx.insert(invoiceRecord).values({
      organizationId: params.organizationId,
      number: draft.number,
      status: provider.isReal ? "open" : "paid",
      periodStart: draft.periodStart,
      periodEnd: draft.periodEnd,
      subtotalCents: draft.subtotalCents,
      discountCents: draft.discountCents,
      totalCents: draft.totalCents,
      lineItems: draft.lineItems,
      provider: provider.key,
      externalId: draft.externalId,
    }),
  );

  return {
    ok: true,
    message: provider.isReal
      ? `Rechnung ${draft.number} erstellt.`
      : `Rechnung ${draft.number} erstellt (simulierte Abrechnung, keine Zahlung).`,
    invoiceNumber: draft.number,
  };
}

/** Provider-Kennzeichnung für die Oberfläche (Spec §4.6: Transparenz). */
export function billingProviderInfo() {
  const provider = getBillingProvider();
  return {
    key: provider.key,
    displayName: provider.displayName,
    isReal: provider.isReal,
    statusNote: provider.statusNote,
  };
}

