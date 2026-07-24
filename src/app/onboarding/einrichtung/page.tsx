import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import { adminDb, withOrg } from "@/server/db/client";
import { integration, knowledgeDocument, member, organization } from "@/server/db/schema";
import { loadOverview } from "@/server/onboarding/service";
import { ONBOARDING_STEPS } from "@/server/onboarding/steps";
import { computeBillingSummary, listPlans } from "@/server/billing/service";
import { getAgentMonthlyPriceCents } from "@/server/billing/pricing";
import { getAgentDefinition } from "@/server/agents/catalog";
import { connectorRegistry } from "@/server/integrations/registry";
import {
  automatisierungOptions,
  departmentOptions,
  groessenOptions,
  softwareOptions,
  umsatzOptions,
  vorgaengeOptions,
  zeitfresserOptions,
} from "@/server/configurator/options";
import { Logo } from "@/components/shared/logo";
import { SetupWizard, type RecommendedAgentView } from "./setup-wizard";

export const metadata = { title: "Einrichtung" };

export default async function SetupPage() {
  const ctx = await requireOrg();
  const overview = await loadOverview(ctx.organizationId, ctx.userId);

  const [org] = await adminDb
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId));

  const [planRows, summary] = await Promise.all([
    listPlans(),
    computeBillingSummary(ctx.organizationId),
  ]);

  const { docCount, connections } = await withOrg(
    ctx.organizationId,
    async (tx) => {
      const [docs] = await tx
        .select({ value: sql<number>`count(*)::int` })
        .from(knowledgeDocument);
      const rows = await tx.select().from(integration);
      return { docCount: docs?.value ?? 0, connections: rows };
    },
  );

  const [memberCount] = await adminDb
    .select({ value: sql<number>`count(*)::int` })
    .from(member)
    .where(eq(member.organizationId, ctx.organizationId));

  const connectedKeys = new Set(
    connections.filter((c) => c.status === "connected").map((c) => c.connectorKey),
  );

  const recommended: RecommendedAgentView[] = overview.recommendation.agents.map(
    (a) => {
      const def = getAgentDefinition(a.slug)!;
      return {
        slug: a.slug,
        personaName: a.personaName,
        roleTitle: a.roleTitle,
        departmentName: a.departmentName,
        reasons: a.reasons,
        requiredIntegrations: a.requiredIntegrations,
        monthlyCents: getAgentMonthlyPriceCents(def),
      };
    },
  );

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <SetupWizard
          steps={ONBOARDING_STEPS}
          initialStep={overview.state.currentStep}
          completedSteps={overview.state.completedSteps}
          organizationName={org?.name ?? "Ihre Organisation"}
          answers={overview.answers}
          recommended={recommended}
          selectedAgents={overview.state.selectedAgents}
          instances={overview.instances}
          plans={planRows.map((p) => ({
            key: p.key,
            name: p.name,
            description: p.description,
            monthlyPriceCents: p.monthlyPriceCents,
            yearlyPricePerMonthCents: p.yearlyPricePerMonthCents,
            includedAgentSeats: p.includedAgentSeats,
            includedRuns: p.includedRuns,
          }))}
          currentPlanKey={summary.planKey}
          currentInterval={summary.billingInterval}
          connectors={connectorRegistry
            .filter((c) => c.status !== "planned")
            .map((c) => ({
              key: c.key,
              name: c.name,
              status: c.status,
              connected: connectedKeys.has(c.key),
            }))}
          knowledgeDocumentCount={docCount}
          teamMemberCount={memberCount?.value ?? 1}
          monthlyTotalCents={summary.totalMonthlyCents}
          canManageBilling={roleHasPermission(ctx.role, "billing", "manage")}
          options={{
            groessen: groessenOptions,
            software: softwareOptions,
            zeitfresser: zeitfresserOptions,
            umsatz: umsatzOptions,
            departments: departmentOptions,
            automatisierung: automatisierungOptions,
            vorgaenge: vorgaengeOptions,
          }}
        />
      </div>
    </div>
  );
}
