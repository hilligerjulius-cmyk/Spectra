import Link from "next/link";
import { InfoIcon } from "lucide-react";
import { requirePlatformAccess } from "@/server/platform/guards";
import {
  listSupportAccess,
  loadPlatformStats,
} from "@/server/platform/service";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Plattform" };

function euro(deciCents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(deciCents / 1000);
}

export default async function AdminOverviewPage() {
  await requirePlatformAccess("support");
  const [stats, accesses] = await Promise.all([
    loadPlatformStats(),
    listSupportAccess(10),
  ]);

  const cards = [
    { label: "Organisationen", value: stats.organizations },
    { label: "Personen", value: stats.users },
    { label: "Agenten-Instanzen", value: stats.agentInstances },
    { label: "Läufe (30 Tage)", value: stats.runs30d },
    { label: "davon fehlgeschlagen", value: stats.failedRuns30d },
    { label: "Aktive Abos", value: stats.activeSubscriptions },
    { label: "Testphasen", value: stats.trialSubscriptions },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plattform-Übersicht"
        description="Kennzahlen über alle Organisationen hinweg — ausschließlich Zählungen, keine Inhalte."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{c.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>KI-Kosten (30 Tage)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {euro(stats.totalCostDeciCents30d)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Grundsatz für diesen Bereich</AlertTitle>
        <AlertDescription>
          Diese Übersicht zeigt nur aggregierte Zahlen. Für den Einblick in die
          Daten einer einzelnen Organisation ist ein protokollierter
          Support-Zugriff mit Begründung nötig — er erscheint auch im Audit-Log
          der betroffenen Organisation.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Letzte Support-Zugriffe</CardTitle>
          <CardDescription>
            <Link href="/admin/organisationen" className="hover:underline">
              Zur Organisationsliste
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accesses.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Bisher kein Support-Zugriff auf Kundendaten.
            </p>
          ) : (
            <ul className="space-y-2">
              {accesses.map((a) => (
                <li key={a.id} className="text-sm">
                  <p>
                    <strong>{a.userLabel}</strong> · {a.organizationName} ·{" "}
                    {a.scope}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.reason} — {a.createdAt.toLocaleString("de-DE")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
