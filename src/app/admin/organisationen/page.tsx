import { InfoIcon } from "lucide-react";
import { requirePlatformAccess } from "@/server/platform/guards";
import {
  listOrganizations,
  listSupportAccess,
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
import { OrgTable } from "./org-table";

export const metadata = { title: "Organisationen" };

export default async function AdminOrganizationsPage() {
  const ctx = await requirePlatformAccess("support");
  const [organizations, accesses] = await Promise.all([
    listOrganizations(),
    listSupportAccess(25),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisationen"
        description="Alle Kundenorganisationen mit aggregierten Zahlen. Inhalte werden hier nicht angezeigt."
      />

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Einsicht ist begründungspflichtig</AlertTitle>
        <AlertDescription>
          Diese Liste zeigt ausschließlich Zählungen. Für einen Einblick in die
          Daten einer Organisation ist eine protokollierte Begründung nötig —
          der Eintrag erscheint auch im Audit-Log der betroffenen Organisation,
          sodass die Kundin jeden Zugriff nachvollziehen kann.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {organizations.length} Organisation(en)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrgTable
            organizations={organizations}
            canManage={ctx.level === "admin"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Protokoll der Einsichten</CardTitle>
          <CardDescription>
            Die letzten {accesses.length} Support-Zugriffe
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
                <li key={a.id} className="rounded-lg border p-3 text-sm">
                  <p>
                    <strong>{a.userLabel}</strong> → {a.organizationName} ·{" "}
                    {a.scope}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.reason}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.createdAt.toLocaleString("de-DE")}
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
