import Link from "next/link";
import { count, desc } from "drizzle-orm";
import {
  ActivityIcon,
  ShieldCheckIcon,
  StoreIcon,
  UsersIcon,
} from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { withOrg } from "@/server/db/client";
import { auditLog } from "@/server/db/schema";
import { PageHeader } from "@/components/shared/page-header";
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
  const { auditCount, recentEvents } = await withOrg(
    ctx.organizationId,
    async (tx) => {
      const [{ value: auditCount }] = await tx
        .select({ value: count() })
        .from(auditLog);
      const recentEvents = await tx
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.createdAt))
        .limit(8);
      return { auditCount, recentEvents };
    },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Der aktuelle Zustand Ihrer digitalen Belegschaft."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <UsersIcon className="size-3.5" /> Aktive Agenten
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1.5">
              <ShieldCheckIcon className="size-3.5" /> Offene Freigaben
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">0</CardTitle>
          </CardHeader>
        </Card>
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
            <CardDescription>Systemzustand</CardDescription>
            <CardTitle className="text-2xl">OK</CardTitle>
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
