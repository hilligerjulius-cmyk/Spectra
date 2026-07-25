import { DatabaseIcon, InfoIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import { ALL_ROLES, roleHasPermission } from "@/server/auth/permissions";
import { CtaBanner, PageIntro, Section } from "@/components/shared/marketing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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

export const metadata = {
  title: "Sicherheit",
  description:
    "Mandantentrennung auf Datenbankebene, Rollen, Freigabepflichten, Verschlüsselung und Schutz gegen Prompt Injection.",
};

const roleDescriptions: Record<string, string> = {
  owner: "Vollzugriff inklusive Abrechnung und Organisationsverwaltung.",
  admin: "Wie Owner, ohne Abrechnung und Eigentumsübertragung.",
  manager: "Departments überwachen, Freigaben entscheiden, Agenten konfigurieren.",
  member: "Agenten nutzen und Freigaben erteilen.",
  viewer: "Ausschließlich lesender Zugriff.",
  billingAdmin: "Nur Abrechnung, kein Zugriff auf operative Daten.",
};

const layers = [
  {
    icon: DatabaseIcon,
    title: "Trennung in der Datenbank",
    text: "Jede Mandantentabelle trägt eine Row-Level-Security-Policy. Die Anwendung verbindet sich mit einer Rolle, die ohne gesetzten Organisationskontext keine Zeile sieht. Selbst ein Fehler in der Anwendungslogik gibt keine fremden Daten frei — das wird durch Tests belegt, die Cross-Tenant-Zugriffe erwarten und scheitern sehen.",
  },
  {
    icon: KeyRoundIcon,
    title: "Getrennte Datenbankrollen",
    text: "Migrationen und Systemjobs laufen unter einer eigenen Rolle. Die Anwendungsrolle hat auf Auth- und Plattformtabellen keinerlei Rechte; Audit-Einträge und Rechnungen kann sie anlegen, aber nicht ändern oder löschen.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Berechtigungen serverseitig",
    text: "Jede Prüfung passiert auf dem Server. Die Oberfläche blendet zusätzlich aus, was nicht erlaubt ist — verlässt sich aber nie darauf. Auch die Mitgliedschaft in einer Organisation wird bei jedem Aufruf erneut in der Datenbank verifiziert.",
  },
];

const injectionDefenses = [
  "Inhalte aus Dokumenten, E-Mails und Fremdsystemen werden als Daten übergeben, nie als Anweisung.",
  "Der Systemprompt weist Anweisungen innerhalb von Daten ausdrücklich zurück.",
  "Ein Agent kann nur Werkzeuge aufrufen, die seine aktive Fähigkeit braucht UND die für ihn freigegeben sind.",
  "Zitierte Fundstellen werden gegen die tatsächlich gelieferten Quellen geprüft; erfundene Belege fallen heraus.",
  "Grenzen für Schritte, Laufzeit, Werkzeugaufrufe und Kosten je Lauf brechen Endlosschleifen ab.",
];

export default function SecurityPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Sicherheit"
        title="Wir verlassen uns nicht darauf, dass der Code fehlerfrei ist"
        lead="Mandantentrennung, Berechtigungen und Freigabepflichten sind mehrfach abgesichert — dort, wo ein Fehler in der Anwendung sie nicht aushebeln kann."
      />

      <Section title="Drei Ebenen der Absicherung">
        <div className="grid gap-4 md:grid-cols-3">
          {layers.map((layer) => (
            <Card key={layer.title}>
              <CardHeader>
                <layer.icon className="size-5 text-primary" />
                <CardTitle className="text-base">{layer.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {layer.text}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Rollen und Freigabeberechtigungen"
        description="Sechs Rollen mit klar getrennten Rechten. Die Tabelle stammt unmittelbar aus der Berechtigungsmatrix im Code — sie kann nicht veralten."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rolle</TableHead>
                <TableHead>Beschreibung</TableHead>
                <TableHead className="text-center">Freigaben</TableHead>
                <TableHead className="text-center">Agenten aktivieren</TableHead>
                <TableHead className="text-center">Wissen verwalten</TableHead>
                <TableHead className="text-center">Abrechnung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_ROLES.map((role) => (
                <TableRow key={role}>
                  <TableCell>
                    <Badge variant="secondary">{role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {roleDescriptions[role]}
                  </TableCell>
                  <TableCell className="text-center">
                    {roleHasPermission(role, "approvals", "decide") ? "ja" : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {roleHasPermission(role, "agents", "activate") ? "ja" : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {roleHasPermission(role, "knowledge", "manage") ? "ja" : "—"}
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
      </Section>

      <Section
        title="Schutz gegen Prompt Injection"
        description="Ein Angreifer könnte versuchen, über den Inhalt einer E-Mail oder eines Dokuments Anweisungen einzuschmuggeln. Dagegen greifen mehrere Maßnahmen gleichzeitig."
      >
        <ul className="space-y-2">
          {injectionDefenses.map((item) => (
            <li key={item} className="flex gap-3 rounded-lg border p-3 text-sm">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Belegt, nicht behauptet</AlertTitle>
          <AlertDescription>
            Diese Abwehr ist durch Tests abgedeckt, die eingeschmuggelte
            Anweisungen aus Dokumenten und E-Mails enthalten und prüfen, dass
            der Agent ihnen nicht folgt.
          </AlertDescription>
        </Alert>
      </Section>

      <Section title="Weitere Maßnahmen">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Verschlüsselte Zugangsdaten",
              text: "Zugangsdaten von Integrationen liegen AES-256-GCM-verschlüsselt in der Datenbank; der Schlüssel kommt ausschließlich aus der Umgebung. Manipulation am Chiffrat fällt beim Entschlüsseln auf.",
            },
            {
              title: "Signierte Webhooks",
              text: "Eingehende Ereignisse müssen eine HMAC-Signatur über Zeitstempel und Nutzlast tragen. Der Vergleich läuft in konstanter Zeit, alte Aufrufe werden abgewiesen.",
            },
            {
              title: "Revisionsfähiges Protokoll",
              text: "Jeder Agentenlauf, jede Freigabe und jede Rollenänderung erzeugt einen Eintrag, den die Anwendungsrolle nicht mehr verändern kann.",
            },
            {
              title: "Protokollierter Support",
              text: "Sieht unser Support in Ihre Daten, erscheint der Zugriff mit Begründung in Ihrem eigenen Audit-Log. Einsicht ohne Spur gibt es nicht.",
            },
            {
              title: "Sicherheits-Kopfzeilen",
              text: "Content-Security-Policy, X-Frame-Options und Permissions-Policy auf allen Antworten; Anmeldung mit CSRF-Schutz und optionaler Zwei-Faktor-Authentifizierung.",
            },
            {
              title: "Abbrechbar",
              text: "Laufende Vorgänge lassen sich abbrechen, Fähigkeiten einzeln abschalten und Agenten pausieren. Bereits ausgeführte Schritte bleiben nachvollziehbar.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {item.text}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Wo wir offen sind">
        <Alert variant="warning">
          <InfoIcon />
          <AlertTitle>Ehrliche Einordnung</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                Eine unabhängige Sicherheitsprüfung durch Dritte hat bisher
                nicht stattgefunden. Wir behaupten keine Zertifizierung, die wir
                nicht haben.
              </li>
              <li>
                Sprachmodelle können irren. Deshalb ist die Freigabe durch einen
                Menschen für wirksame Aktionen nicht optional, sondern in den
                Katalogregeln festgeschrieben.
              </li>
              <li>
                Wer eigene Integrationen anbindet, verlagert Vertrauen zu diesem
                Anbieter. Welche Anbindung wirklich aktiv ist, steht jederzeit in
                den Einstellungen.
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </Section>

      <CtaBanner
        title="Fragen zur Absicherung?"
        text="Wir beantworten technische Rückfragen gern konkret — auch die unangenehmen."
        href="/kontakt"
        label="Kontakt aufnehmen"
      />
    </div>
  );
}
