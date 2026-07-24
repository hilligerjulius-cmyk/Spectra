import { requirePermission } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import {
  billingProviderInfo,
  computeBillingSummary,
  listInvoices,
  listPlans,
} from "@/server/billing/service";
import { yearlySavingsPercent } from "@/server/billing/plans";
import { PageHeader } from "@/components/shared/page-header";
import { BillingView, type PlanView } from "./billing-view";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  // "view" reicht zum Ansehen; Änderungen erfordern zusätzlich "manage".
  const ctx = await requirePermission("billing", "view");
  const canManage = roleHasPermission(ctx.role, "billing", "manage");

  const [summary, planRows, invoiceRows] = await Promise.all([
    computeBillingSummary(ctx.organizationId),
    listPlans(),
    listInvoices(ctx.organizationId),
  ]);

  const plans: PlanView[] = planRows.map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    monthlyPriceCents: p.monthlyPriceCents,
    yearlyPricePerMonthCents: p.yearlyPricePerMonthCents,
    includedAgentSeats: p.includedAgentSeats,
    includedRuns: p.includedRuns,
    includedAiCostDeciCents: p.includedAiCostDeciCents,
    maxTeamMembers: p.maxTeamMembers,
    features: p.features,
    setupFeeCents: p.setupFeeCents,
    yearlySavingsPercent: yearlySavingsPercent(p),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Plan, gebuchte digitale Mitarbeiter, Verbrauch und Rechnungen. Alle Preise werden serverseitig berechnet."
      />
      <BillingView
        summary={{
          planKey: summary.planKey,
          planName: summary.planName,
          billingInterval: summary.billingInterval,
          status: summary.status,
          trialEndsAt: summary.trialEndsAt,
          currentPeriodEnd: summary.currentPeriodEnd,
          cancelAtPeriodEnd: summary.cancelAtPeriodEnd,
          platformFeeCents: summary.platformFeeCents,
          agentLines: summary.agentLines,
          bundleLines: summary.bundleLines,
          includedAgentSeats: summary.includedAgentSeats,
          billableAgentCount: summary.billableAgentCount,
          volumeDiscountCents: summary.volumeDiscountCents,
          volumeDiscountPercent: summary.volumeDiscountPercent,
          couponCode: summary.couponCode,
          couponPercent: summary.couponPercent,
          couponDiscountCents: summary.couponDiscountCents,
          totalMonthlyCents: summary.totalMonthlyCents,
          usage: summary.usage,
          limitReached: summary.limitReached,
          limitWarning: summary.limitWarning,
        }}
        plans={plans}
        invoices={invoiceRows.map((i) => ({
          id: i.id,
          number: i.number,
          status: i.status,
          periodStart: i.periodStart.toISOString(),
          periodEnd: i.periodEnd.toISOString(),
          totalCents: i.totalCents,
          provider: i.provider,
          lineItems: i.lineItems,
        }))}
        provider={billingProviderInfo()}
        canManage={canManage}
      />
    </div>
  );
}
