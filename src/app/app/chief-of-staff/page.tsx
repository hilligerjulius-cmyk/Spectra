import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  AlertTriangleIcon,
  ClockIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import { withOrg } from "@/server/db/client";
import {
  agentInstance,
  agentRun,
  approvalRequest,
  task,
} from "@/server/db/schema";
import { getAgentDefinition } from "@/server/agents/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { BriefingPanel } from "./briefing-panel";

export const metadata = { title: "Chief of Staff" };

type TaskRow = typeof task.$inferSelect;

/**
 * Teilt offene Aufgaben nach Dringlichkeit auf. Bewusst außerhalb der
 * Komponente: Die Einteilung hängt von der aktuellen Uhrzeit ab und ist damit
 * Datenableitung, nicht Rendering.
 */
function bucketTasks(openTasks: TaskRow[]) {
  const now = Date.now();
  const soon = now + 3 * 24 * 60 * 60 * 1000;
  const overdue = openTasks.filter(
    (t) => t.dueAt !== null && t.dueAt.getTime() < now,
  );
  const dueSoon = openTasks.filter(
    (t) =>
      t.dueAt !== null && t.dueAt.getTime() >= now && t.dueAt.getTime() <= soon,
  );
  const urgent = openTasks.filter(
    (t) => t.priority === "urgent" || t.priority === "high",
  );
  return { overdue, dueSoon, urgent };
}

export default async function ChiefOfStaffPage() {
  const ctx = await requireOrg();
  const canRun = roleHasPermission(ctx.role, "agents", "run");

  const {
    instance,
    briefings,
    openTasks,
    pendingApprovals,
    recentRuns,
  } = await withOrg(ctx.organizationId, async (tx) => {
    const [instance] = await tx
      .select()
      .from(agentInstance)
      .where(eq(agentInstance.definitionSlug, "chief-of-staff"));

    const openTasks = await tx
      .select()
      .from(task)
      .where(sql`${task.status} in ('open', 'in_progress')`)
      .orderBy(desc(task.createdAt))
      .limit(50);

    const pendingApprovals = await tx
      .select()
      .from(approvalRequest)
      .where(eq(approvalRequest.status, "pending"))
      .orderBy(desc(approvalRequest.createdAt))
      .limit(10);

    const recentRuns = instance
      ? await tx
          .select()
          .from(agentRun)
          .where(eq(agentRun.agentInstanceId, instance.id))
          .orderBy(desc(agentRun.createdAt))
          .limit(5)
      : [];

    // Briefings werden als Aufgabe mit Volltext hinterlegt (siehe briefing.write).
    const briefings = instance
      ? await tx
          .select()
          .from(task)
          .where(
            and(
              eq(task.agentInstanceId, instance.id),
              sql`${task.title} like '%riefing%'`,
            ),
          )
          .orderBy(desc(task.createdAt))
          .limit(3)
      : [];

    return { instance, briefings, openTasks, pendingApprovals, recentRuns };
  });

  if (!instance) {
    const def = getAgentDefinition("chief-of-staff")!;
    return (
      <div className="space-y-6">
        <PageHeader
          title="Chief of Staff"
          description="Ihre zentrale Koordinationsinstanz: Prioritäten, Risiken, Freigaben."
        />
        <EmptyState
          icon={<SparklesIcon />}
          title={`${def.personaName} ist noch nicht Teil Ihres Teams`}
          description={`${def.tagline} — koordiniert Ihre digitalen Mitarbeiter, bündelt Freigaben und erstellt Tagesbriefings aus echten Daten Ihrer Organisation.`}
          action={
            <Button asChild>
              <Link href="/app/marketplace/chief-of-staff">
                {def.personaName} einstellen
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const definition = getAgentDefinition("chief-of-staff")!;
  const { overdue, dueSoon, urgent } = bucketTasks(openTasks);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chief of Staff"
        description={`${instance.displayName} — ${definition.roleTitle}. Alle Angaben stammen aus den Daten dieser Organisation.`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={instance.status === "active" ? "active" : "warning"}>
          {instance.status === "active"
            ? "Aktiv"
            : instance.status === "sandbox"
              ? "Sandbox"
              : instance.status}
        </Badge>
        <BriefingPanel
          instanceId={instance.id}
          canRun={canRun && instance.status !== "disabled"}
          availableCapabilities={definition.capabilities
            .filter((c) => !instance.disabledCapabilities.includes(c.key))
            .map((c) => c.key)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ClockIcon className="size-3.5" /> Offene Aufgaben
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {openTasks.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <AlertTriangleIcon className="size-3.5" /> Überfällig
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums text-status-error">
              {overdue.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fällig in 3 Tagen</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {dueSoon.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Link href="/app/approvals">
          <Card className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5" /> Offene Freigaben
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {pendingApprovals.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Heutige Prioritäten</CardTitle>
            <CardDescription>
              Überfällige zuerst, danach nach Priorität
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overdue.length === 0 && urgent.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Keine überfälligen oder hoch priorisierten Aufgaben.
              </p>
            ) : (
              <ul className="space-y-2">
                {[...overdue, ...urgent.filter((t) => !overdue.includes(t))]
                  .slice(0, 8)
                  .map((t) => (
                    <li
                      key={t.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">{t.title}</span>
                      <div className="flex shrink-0 gap-1.5">
                        {overdue.includes(t) ? (
                          <Badge variant="error">überfällig</Badge>
                        ) : null}
                        <Badge variant="outline">{t.priority}</Badge>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Wartet auf Ihre Entscheidung</CardTitle>
            <CardDescription>
              Vorbereitete Aktionen — nichts davon wurde ausgeführt
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pendingApprovals.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Keine offenen Freigaben.
              </p>
            ) : (
              <ul className="space-y-2">
                {pendingApprovals.map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">{a.title}</span>
                      <Badge
                        variant={
                          a.riskLevel === "high"
                            ? "error"
                            : a.riskLevel === "medium"
                              ? "warning"
                              : "secondary"
                        }
                      >
                        {a.riskLevel}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.reasoning}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {pendingApprovals.length > 0 ? (
              <Button size="sm" variant="outline" className="mt-4" asChild>
                <Link href="/app/approvals">Zum Approval Center</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {briefings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Briefings</CardTitle>
            <CardDescription>
              Erstellt aus den Aufgaben- und Aktivitätsdaten dieser Organisation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {briefings.map((b) => (
              <article key={b.id}>
                <h3 className="text-sm font-medium">{b.title}</h3>
                <p className="mb-1 text-xs text-muted-foreground">
                  {b.createdAt.toLocaleString("de-DE")}
                </p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-sans text-sm">
                  {b.description}
                </pre>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {recentRuns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Letzte Läufe</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recentRuns.map((r) => (
                <li key={r.id} className="flex items-start gap-3 text-sm">
                  <Badge
                    variant={
                      r.status === "completed"
                        ? "active"
                        : r.status === "failed"
                          ? "error"
                          : "warning"
                    }
                    className="shrink-0"
                  >
                    {r.status}
                  </Badge>
                  <div className="min-w-0">
                    <p>{r.summary ?? r.goal}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.createdAt.toLocaleString("de-DE")}
                      {r.sandbox ? " · Sandbox" : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
