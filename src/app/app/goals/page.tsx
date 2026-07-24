import Link from "next/link";
import { InfoIcon, TargetIcon } from "lucide-react";
import { requirePermission } from "@/server/auth/guards";
import { loadGoals } from "@/server/reports/service";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Goals" };

export default async function GoalsPage() {
  const ctx = await requirePermission("goals", "view");
  const goals = await loadGoals(ctx.organizationId, 30);

  const measured = goals.reduce(
    (sum, g) => sum + g.kpis.filter((k) => k.value !== null).length,
    0,
  );
  const total = goals.reduce((sum, g) => sum + g.kpis.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goals"
        description="Die Zielkennzahlen jedes digitalen Mitarbeiters, gemessen an den Läufen der letzten 30 Tage."
      />

      {goals.length === 0 ? (
        <EmptyState
          icon={<TargetIcon />}
          title="Noch keine Agenten im Team"
          description="Sobald Sie digitale Mitarbeiter einstellen, erscheinen hier deren Zielkennzahlen — gemessen an tatsächlichen Läufen, nicht an Beispielwerten."
          action={
            <Button asChild>
              <Link href="/app/marketplace">Zum Marketplace</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Alert variant="info">
            <InfoIcon />
            <AlertTitle>
              {measured} von {total} Kennzahlen sind derzeit messbar
            </AlertTitle>
            <AlertDescription>
              Kennzahlen ohne belastbare Datenquelle bleiben leer statt
              geschätzt zu werden. Sie füllen sich, sobald die zugehörigen
              Datenquellen verbunden sind und Läufe stattgefunden haben.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            {goals.map((goal) => (
              <Card key={goal.instanceId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        <Link
                          href={`/app/agents/${goal.instanceId}`}
                          className="hover:underline"
                        >
                          {goal.displayName}
                        </Link>
                      </CardTitle>
                      <CardDescription>{goal.roleTitle}</CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {goal.kpis.filter((k) => k.value !== null).length}/
                      {goal.kpis.length} messbar
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {goal.kpis.map((kpi) => (
                      <li key={kpi.key}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm">{kpi.label}</span>
                          <span className="shrink-0 tabular-nums font-medium">
                            {kpi.value !== null ? (
                              <>
                                {kpi.value}{" "}
                                <span className="text-xs font-normal text-muted-foreground">
                                  {kpi.unit}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-normal text-muted-foreground">
                                keine Daten
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {kpi.basis}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
