import { eq } from "drizzle-orm";
import { KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { ALL_ROLES, roleHasPermission } from "@/server/auth/permissions";
import { adminDb } from "@/server/db/client";
import { organization } from "@/server/db/schema";
import {
  getOrCreatePreference,
  mailProviderInfo,
  NOTIFICATION_TYPES,
} from "@/server/notifications/service";
import { getAIProvider } from "@/server/ai";
import { billingProviderInfo } from "@/server/billing/service";
import { providerStatus } from "@/lib/env";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NotificationSettings } from "./notification-settings";

export const metadata = { title: "Settings" };

/** Rollenbeschreibungen für die Übersicht (Spec §7). */
const roleDescriptions: Record<string, string> = {
  owner:
    "Vollzugriff inklusive Abrechnung, Eigentumsübertragung und Löschung der Organisation.",
  admin:
    "Wie Owner, jedoch ohne Abrechnungsverwaltung, Eigentumsübertragung und Löschung.",
  manager:
    "Überwacht Departments, entscheidet Freigaben und konfiguriert zugewiesene Agenten.",
  member: "Nutzt Agenten und erteilt Freigaben, soweit berechtigt.",
  viewer: "Ausschließlich lesender Zugriff.",
  billingAdmin:
    "Verwaltet ausschließlich die Abrechnung; kein Zugriff auf operative Unternehmensdaten.",
};

export default async function SettingsPage() {
  const ctx = await requireOrg();
  const [org] = await adminDb
    .select({ name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId));

  const preference = await getOrCreatePreference(ctx.organizationId, ctx.userId);
  const mail = mailProviderInfo();
  const ai = getAIProvider();
  const billing = billingProviderInfo();

  const providers = [
    {
      name: "KI-Modell",
      value: ai.isReal
        ? "Anthropic (Live-Modell)"
        : "Regelbasierter Demo-Provider",
      real: ai.isReal,
      note: ai.isReal
        ? "Läufe nutzen das konfigurierte Sprachmodell; es entstehen Modellkosten."
        : "Ohne ANTHROPIC_API_KEY arbeiten Agenten deterministisch und regelbasiert. Die Qualität ist bewusst begrenzt, das Verhalten reproduzierbar.",
    },
    {
      name: "Embeddings",
      value: providerStatus.voyage ? "Voyage AI" : "Lokal (Wortform-Ähnlichkeit)",
      real: providerStatus.voyage,
      note: providerStatus.voyage
        ? "Semantische Suche über den konfigurierten Anbieter."
        : "Der lokale Fallback vergleicht Wortformen, nicht Bedeutung. Ein Wechsel des Anbieters erfordert eine Neu-Indexierung aller Dokumente.",
    },
    {
      name: "E-Mail-Versand",
      value: mail.isReal ? "SMTP" : "Postausgang (kein Versand)",
      real: mail.isReal,
      note: mail.note,
    },
    {
      name: "Abrechnung",
      value: billing.displayName,
      real: billing.isReal,
      note: billing.statusNote,
    },
    {
      name: "Google OAuth",
      value: providerStatus.googleOAuth ? "Konfiguriert" : "Nicht konfiguriert",
      real: providerStatus.googleOAuth,
      note: providerStatus.googleOAuth
        ? "Gmail und Google Calendar können verbunden werden."
        : "Ohne GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET lassen sich Gmail und Google Calendar nicht verbinden.",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Organisation, Benachrichtigungen, Rollen und Systemzustand."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organisation</CardTitle>
          <CardDescription>
            Ihr Arbeitsbereich ist auf Datenbankebene von allen anderen
            Organisationen getrennt (Row Level Security).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{org?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Kennung</span>
            <span className="font-mono text-xs">{org?.slug}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ihre Rolle</span>
            <Badge variant="secondary">{ctx.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <NotificationSettings
        emailIsReal={mail.isReal}
        types={NOTIFICATION_TYPES.map((t) => ({
          key: t.key,
          label: t.label,
          description: t.description,
        }))}
        initial={{
          inAppTypes: preference.inAppTypes,
          emailTypes: preference.emailTypes,
          dailyDigest: preference.dailyDigest,
          digestHour: preference.digestHour,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheckIcon className="size-4" />
            Rollen und Freigabeberechtigungen
          </CardTitle>
          <CardDescription>
            Berechtigungen werden serverseitig geprüft — die Oberfläche blendet
            lediglich zusätzlich aus, was nicht erlaubt ist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="text-center">Freigaben</TableHead>
                  <TableHead className="text-center">Agenten aktiv.</TableHead>
                  <TableHead className="text-center">Abrechnung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ALL_ROLES.map((role) => (
                  <TableRow key={role}>
                    <TableCell>
                      <Badge
                        variant={role === ctx.role ? "active" : "secondary"}
                      >
                        {role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {roleDescriptions[role]}
                    </TableCell>
                    <TableCell className="text-center">
                      {roleHasPermission(role, "approvals", "decide")
                        ? "ja"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {roleHasPermission(role, "agents", "activate")
                        ? "ja"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {roleHasPermission(role, "billing", "manage")
                        ? "verwalten"
                        : roleHasPermission(role, "billing", "view")
                          ? "einsehen"
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRoundIcon className="size-4" />
            Systemzustand
          </CardTitle>
          <CardDescription>
            Welche Dienste tatsächlich aktiv sind — ohne Beschönigung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {providers.map((p) => (
              <li key={p.name} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.note}</p>
                </div>
                <Badge
                  variant={p.real ? "active" : "warning"}
                  className="shrink-0"
                >
                  {p.value}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
