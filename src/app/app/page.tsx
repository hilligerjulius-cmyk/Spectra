import Link from "next/link";
import { count, desc } from "drizzle-orm";
import {
  ActivityIcon,
  RocketIcon,
  ShieldCheckIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireOrg } from "@/server/auth/guards";
import { withOrg } from "@/server/db/client";
import {
  agentInstance,
  approvalRequest,
  auditLog,
  onboardingState,
  task,
} from "@/server/db/schema";
import { ONBOARDING_STEP_COUNT } from "@/server/onboarding/steps";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const ctx = await requireOrg();

  // Reale Daten der aktiven Organisation (RLS-gescoped) — keine erfundenen Kennzahlen.
  const { auditCount, recentEvents, activeAgents, openApprovals, doneTasks } =
    await withOrg(ctx.organizationId, async (tx) => {
      const [{ value: auditCount }] = await tx
        .select({ value: count() })
        .from(auditLog);
      const recentEvents = await tx
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(8);
      const [{ value: activeAgents }] = await tx
        .select({ value: count() })
        .from(agentInstance)
        .where(eq(agentInstance.status, "active"));
      const [{ value: openApprovals }] = await tx
        .select({ value: count() })
        .from(approvalRequest)
        .where(eq(approvalRequest.status, "pending"));
      const [{ value: doneTasks }] = await tx
        .select({ value: count() })
        .from(task)
        .where(and(eq(task.status, "done")));
      return { auditCount, recentEvents, activeAgents, openApprovals, doneTasks };
    });

  // Hinweis auf die Einrichtung nur, solange sie tatsächlich offen ist.
  const [onboarding] = await withOrg(ctx.organizationId, (tx) =>
    tx
      .select({
        completed: onboardingState.completed,
        currentStep: onboardingState.currentStep,
      })
      .from(onboardingState)
      .where(eq(onboardingState.organizationId, ctx.organizationId)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Der aktuelle Zustand Ihrer digitalen Belegschaft."
      />

      {onboarding && !onboarding.completed ? (
        <Alert variant="info">
          <RocketIcon />
          <AlertTitle>Einrichtung fortsetzen</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Sie sind bei Schritt {onboarding.currentStep} von{" "}
              {ONBOARDING_STEP_COUNT}. Der Assistent führt Sie bis zum
              Sandbox-Testlauf und zur Aktivierung.
            </p>
            <Button size="sm" asChild>
              <Link href="/onboarding/einrichtung">Weiter einrichten</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <UsersIcon className="size-3.5" /> Aktive Agenten
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{activeAgents}</CardTitle>
          </CardHeader>
        </Card>
        <Link href="/app/approvals">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5" /> Offene Freigaben
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">{openApprovals}</CardTitle>
            </CardHeader>
          </Card>
        </Link>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ActivityIcon className="size-3.5" /> Protokollierte Ereignisse
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{auditCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Erledigte Aufgaben</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{doneTasks}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {recentEvents.length === 0 ? (
        <EmptyState
          icon={<StoreIcon />}
          title="Noch keine digitalen Mitarbeiter aktiv"
          description="Stellen Sie Ihr Team im Marketplace zusammen. Jeder Agent startet in einem sicheren Sandbox-Modus, bevor er echte Systeme berührt."
          action={
            <Button asChild>
              <Link href="/app/marketplace">Zum Marketplace</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Aktivität</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {recentEvents.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>{event.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.actorLabel} ·{" "}
                      {event.createdAt.toLocaleString("de-DE")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
