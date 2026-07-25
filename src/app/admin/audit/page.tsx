import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { requirePlatformAccess } from "@/server/platform/guards";
import { listOrganizations, searchAuditLog } from "@/server/platform/service";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Audit-Suche" };

/**
 * Organisationsübergreifende Audit-Suche.
 *
 * Das Audit-Log enthält bewusst nur Metadaten und kurze Zusammenfassungen,
 * keine Inhalte von Kundendaten — deshalb ist die Suche hier ohne
 * Einzelfall-Begründung möglich. Wer Inhalte sehen will, braucht einen
 * protokollierten Support-Zugriff (siehe Organisationen).
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; aktion?: string }>;
}) {
  await requirePlatformAccess("support");
  const params = await searchParams;

  const [entries, organizations] = await Promise.all([
    searchAuditLog({
      organizationId: params.org?.trim() || undefined,
      action: params.aktion?.trim() || undefined,
      limit: 150,
    }),
    listOrganizations(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit-Suche"
        description="Metadaten aller protokollierten Ereignisse über Organisationen hinweg. Keine Inhalte von Kundendaten."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter</CardTitle>
          <CardDescription>
            Nach Organisation und/oder Aktionsname einschränken
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Bewusst ein GET-Formular: die Suche ist teilbar und ohne JavaScript nutzbar. */}
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="min-w-56 flex-1 space-y-1.5">
              <Label htmlFor="org">Organisation</Label>
              <select
                id="org"
                name="org"
                defaultValue={params.org ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Alle Organisationen</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor="aktion">Aktion enthält</Label>
              <Input
                id="aktion"
                name="aktion"
                defaultValue={params.aktion ?? ""}
                placeholder="z. B. approval, agent.run, support"
              />
            </div>
            <Button type="submit">
              <SearchIcon />
              Suchen
            </Button>
            {params.org || params.aktion ? (
              <Button type="button" variant="ghost" asChild>
                <Link href="/admin/audit">Filter zurücksetzen</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {entries.length} Eintrag/Einträge
            {entries.length === 150 ? " (Anzeige begrenzt)" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Keine Einträge für diese Filter.
            </p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        e.action.includes("failed")
                          ? "error"
                          : e.action.startsWith("support.")
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {e.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {e.organizationName} · {e.actorType}: {e.actorLabel}
                    </span>
                  </div>
                  <p className="mt-1">{e.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {e.createdAt.toLocaleString("de-DE")}
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
