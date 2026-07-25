import Link from "next/link";
import {
  CheckCircle2Icon,
  ConstructionIcon,
  InfoIcon,
  KeyRoundIcon,
} from "lucide-react";
import { connectorRegistry } from "@/server/integrations/registry";
import { CtaBanner, PageIntro, Section } from "@/components/shared/marketing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Integrationen",
  description:
    "Welche Systeme heute wirklich angebunden sind, welche Zugangsdaten brauchen und welche noch nicht implementiert sind.",
};

const categoryLabels: Record<string, string> = {
  email: "E-Mail",
  calendar: "Kalender",
  crm: "CRM",
  files: "Dateien",
  accounting: "Buchhaltung",
  chat: "Chat",
  generic: "Allgemein",
};

export default function IntegrationsPage() {
  const implemented = connectorRegistry.filter(
    (c) => c.status === "implemented",
  );
  const needsCredentials = connectorRegistry.filter(
    (c) => c.status === "credentials_required",
  );
  const planned = connectorRegistry.filter((c) => c.status === "planned");

  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Integrationen"
        title="Was heute wirklich angebunden ist"
        lead="Diese Seite unterscheidet streng zwischen fertig, „braucht Zugangsdaten“ und noch nicht implementiert. Sie stammt unmittelbar aus dem Connector-Verzeichnis der Anwendung."
      />

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Warum wir das so genau trennen</AlertTitle>
        <AlertDescription>
          Eine Integration, die es nicht gibt, wird bei uns nicht als
          „demnächst verfügbar“ verkauft und schon gar nicht simuliert. Ruft ein
          Agent ein Werkzeug auf, dessen Anbindung fehlt, meldet er den fehlenden
          Zugriff — statt ein plausibel klingendes Ergebnis zu erfinden.
        </AlertDescription>
      </Alert>

      <Section
        title={`Sofort nutzbar (${implemented.length})`}
        description="Ohne zusätzliche Zugangsdaten einsatzbereit."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {implemented.map((c) => (
            <Card key={c.key}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <CardDescription>
                      {categoryLabels[c.category] ?? c.category}
                    </CardDescription>
                  </div>
                  <Badge variant="active">
                    <CheckCircle2Icon /> Fertig
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {c.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title={`Implementiert, Zugangsdaten erforderlich (${needsCredentials.length})`}
        description="Der Adapter ist vorhanden. Ohne hinterlegte Zugangsdaten bleibt die Anbindung gesperrt — die Oberfläche sagt genau, was fehlt."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {needsCredentials.map((c) => (
            <Card key={c.key}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <CardDescription>
                      {categoryLabels[c.category] ?? c.category}
                    </CardDescription>
                  </div>
                  <Badge variant="warning">
                    <KeyRoundIcon /> Zugangsdaten
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{c.description}</p>
                {c.requiredEnv && c.requiredEnv.length > 0 ? (
                  <p className="font-mono text-xs">
                    Benötigt: {c.requiredEnv.join(", ")}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title={`Noch nicht implementiert (${planned.length})`}
        description="Vorgesehen, aber nicht gebaut. Bis dahin führen Webhooks und CSV-Import zum Ziel."
      >
        <div className="flex flex-wrap gap-2">
          {planned.map((c) => (
            <Badge key={c.key} variant="paused" className="px-3 py-1">
              <ConstructionIcon /> {c.name}
            </Badge>
          ))}
        </div>
      </Section>

      <Section
        title="Der Weg für alles andere"
        description="Für Systeme ohne fertigen Connector gibt es zwei Wege, die heute funktionieren."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signierte Webhooks</CardTitle>
              <CardDescription>
                Ihr System sendet, die Plattform legt einen Vorgang an
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Sie erzeugen ein Signaturgeheimnis und senden Ereignisse per
                HTTPS. Jeder Aufruf muss eine HMAC-Signatur über Zeitstempel und
                Nutzlast tragen; alte oder unsignierte Aufrufe werden abgewiesen.
              </p>
              <p>
                Damit lassen sich Rechnungseingänge, Tickets oder Aufgaben aus
                nahezu jedem System übernehmen.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">CSV-Import und -Export</CardTitle>
              <CardDescription>
                Für Bestandsdaten und Auswertungen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Aufgaben, Deals, Kontakte, Tickets und Beschäftigte lassen sich
                als CSV einlesen — mit Semikolon, Komma oder Tabulator, auch
                direkt aus Excel. Fehlerhafte Zeilen werden übersprungen und
                einzeln mit Zeilennummer benannt; Dubletten werden gemeldet,
                nicht überschrieben.
              </p>
              <p>
                Exportieren können Sie Aufgaben, Deals und alle Agentenläufe
                inklusive Kosten.
              </p>
              <p>
                Damit arbeiten die Agenten auf einem echten Datenbestand, auch
                ohne angebundenes Fremdsystem. Diese Bestände sind bewusst
                schlank und ersetzen kein gewachsenes CRM, Helpdesk oder
                HR-System — sie schließen die Lücke, bis der passende Connector
                steht.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Weiterlesen">
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/sicherheit", label: "Wie Zugangsdaten geschützt werden" },
            { href: "/agenten", label: "Welcher Agent welche Quelle braucht" },
            { href: "/preise", label: "Preise" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border px-4 py-2 text-sm transition-colors hover:bg-muted"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </Section>

      <CtaBanner
        title="Ihr System fehlt?"
        text="Sagen Sie uns, was Sie anbinden möchten. Wir sagen ehrlich, ob und wann das geht."
        href="/kontakt"
        label="Anbindung anfragen"
      />
    </div>
  );
}
