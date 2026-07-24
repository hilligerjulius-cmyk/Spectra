import { requirePermission } from "@/server/auth/guards";
import { loadReport } from "@/server/reports/service";
import { getAIProvider } from "@/server/ai";
import { PageHeader } from "@/components/shared/page-header";
import { ReportsView } from "./reports-view";

export const metadata = { title: "Reports" };

const ALLOWED_PERIODS = [7, 30, 90];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tage?: string }>;
}) {
  const ctx = await requirePermission("reports", "view");
  const params = await searchParams;
  const requested = Number.parseInt(params.tage ?? "30", 10);
  const periodDays = ALLOWED_PERIODS.includes(requested) ? requested : 30;

  const report = await loadReport(ctx.organizationId, periodDays);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Alle Kennzahlen stammen aus tatsächlichen Agentenläufen dieser Organisation. Schätzwerte sind ausdrücklich als solche gekennzeichnet."
      />
      <ReportsView
        periodDays={periodDays}
        report={{
          periodDays: report.periodDays,
          stats: report.stats,
          agents: report.agents.map((a) => ({
            instanceId: a.instanceId,
            displayName: a.displayName,
            roleTitle: a.roleTitle,
            runs: a.runs,
            completed: a.completed,
            failed: a.failed,
            successRate: a.successRate,
            costDeciCents: a.costDeciCents,
            averageDurationMs: a.averageDurationMs,
            estimatedMinutesSaved: a.estimatedMinutesSaved,
            lastRunAt: a.lastRunAt,
          })),
          approvals: report.approvals,
          tasks: report.tasks,
          dailyRuns: report.dailyRuns,
          estimatedMinutesSaved: report.estimatedMinutesSaved,
          costsAreZeroBecauseScripted: report.costsAreZeroBecauseScripted,
          aiProviderIsReal: getAIProvider().isReal,
        }}
      />
    </div>
  );
}
