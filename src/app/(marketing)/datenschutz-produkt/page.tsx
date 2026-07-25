import { InfoIcon } from "lucide-react";
import { CtaBanner, PageIntro, Section } from "@/components/shared/marketing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  title: "Datenschutz im Produkt",
  description:
    "Welche Daten die Plattform verarbeitet, wozu, wie lange — und welche Einstellungen Sie dafür haben.",
};

const dataKinds = [
  {
    kind: "Konto- und Organisationsdaten",
    purpose: "Anmeldung, Rollen, Zuordnung zur Organisation",
    retention: "Bis zur Löschung des Kontos",
  },
  {
    kind: "Inhalte aus verbundenen Quellen",
    purpose:
      "Bearbeitung der Aufgabe, für die Sie den Agenten eingesetzt haben",
    retention:
      "Solange die Quelle verbunden ist; Demo-Daten jederzeit entfernbar",
  },
  {
    kind: "Dokumente der Wissensbasis",
    purpose: "Beantwortung von Fragen mit Quellenangabe",
    retention: "Bis Sie das Dokument löschen",
  },
  {
    kind: "Agentenläufe und Schritte",
    purpose: "Nachvollziehbarkeit, Fehlersuche, Kostenübersicht",
    retention: "Dauerhaft, solange die Organisation besteht",
  },
  {
    kind: "Audit-Protokoll",
    purpose: "Revisionssicherheit sicherheitsrelevanter Vorgänge",
    retention:
      "Append-only — durch die Anwendung nicht änderbar oder löschbar",
  },
  {
    kind: "Verbrauchsdaten",
    purpose: "Kontingente und Abrechnung",
    retention: "Je Abrechnungsperiode",
  },
];

const controls = [
  {
    title: "Datenquellen einzeln freigeben",
    text: "Ein Agent sieht ausschließlich Quellen, die Sie ihm zugewiesen haben. Werkzeuge ohne Freigabe verweigern den Zugriff, statt Daten aus anderen Quellen zu ziehen.",
  },
  {
    title: "Zugriffsbereiche in der Wissensbasis",
    text: "Dokumente lassen sich auf bestimmte Rollen begrenzen. Wer kein Recht hat, erhält den Inhalt auch nicht in zusammengefasster Form.",
  },
  {
    title: "Automatisierungsstufe je Fähigkeit",
    text: "Sie bestimmen, ob ein Agent nur beobachtet, entwirft oder nach Freigabe handelt. Aktionen mit Außenwirkung bleiben immer freigabepflichtig.",
  },
  {
    title: "Kein Versand ohne Konfiguration",
    text: "Ohne hinterlegten SMTP-Zugang verlässt keine E-Mail die Plattform. Ausgehende Nachrichten liegen einsehbar im Postausgang.",
  },
  {
    title: "Löschen und Exportieren",
    text: "Aufgaben, Deals und Agentenläufe lassen sich als CSV exportieren; Demo-Daten und Dokumente vollständig entfernen.",
  },
  {
    title: "Support nur mit Protokoll",
    text: "Ein Einblick unseres Supports erscheint mit Begründung in Ihrem eigenen Audit-Log.",
  },
];

export default function ProductPrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Datenschutz im Produkt"
        title="Welche Daten wofür verarbeitet werden"
        lead="Diese Seite beschreibt die technische Verarbeitung im Produkt. Sie ist keine Datenschutzerklärung im rechtlichen Sinne — die steht separat."
      />

      <Section
        title="Verarbeitete Datenarten"
        description="Was die Plattform speichert, wozu und wie lange."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datenart</TableHead>
                <TableHead>Zweck</TableHead>
                <TableHead>Aufbewahrung</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataKinds.map((row) => (
                <TableRow key={row.kind}>
                  <TableCell className="font-medium">{row.kind}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.purpose}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.retention}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section
        title="Ihre Einstellmöglichkeiten"
        description="Datenschutz entsteht hier nicht durch Zusicherungen, sondern durch Einstellungen, die tatsächlich wirken."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {controls.map((control) => (
            <Card key={control.title}>
              <CardHeader>
                <CardTitle className="text-base">{control.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {control.text}
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section title="Verarbeitung durch Dritte">
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Nur was Sie einschalten</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                <strong>Sprachmodell:</strong> Ohne hinterlegten Schlüssel
                arbeitet die Plattform mit einem lokalen, regelbasierten
                Verfahren — es verlassen keine Inhalte das System. Mit
                Schlüssel werden Inhalte an den Modellanbieter übermittelt.
              </li>
              <li>
                <strong>Embeddings:</strong> Ohne Schlüssel wird lokal
                gerechnet. Mit Schlüssel gehen Textausschnitte an den Anbieter.
              </li>
              <li>
                <strong>Zahlungsanbieter:</strong> Ohne Schlüssel läuft die
                Abrechnung simuliert und ohne Datenweitergabe. Mit Stripe
                werden Zahlungsdaten dort verarbeitet — nicht bei uns
                gespeichert.
              </li>
              <li>
                <strong>E-Mail-Versand:</strong> Ohne SMTP-Zugang wird nichts
                versendet.
              </li>
            </ul>
            <p className="mt-2">
              Welche dieser Dienste in Ihrer Installation tatsächlich aktiv
              sind, steht jederzeit in den Einstellungen unter „Systemzustand“ —
              ohne Beschönigung.
            </p>
          </AlertDescription>
        </Alert>
      </Section>

      <Section title="Wozu Daten nicht verwendet werden">
        <ul className="space-y-2">
          {[
            "Nicht zum Training von Modellen.",
            "Nicht zur Weitergabe an Dritte außerhalb der von Ihnen aktivierten Dienste.",
            "Nicht zur Profilbildung über Ihre Beschäftigten.",
            "Nicht für Werbung.",
          ].map((item) => (
            <li key={item} className="rounded-lg border p-3 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <CtaBanner
        title="Fragen zur Verarbeitung?"
        text="Für einen Auftragsverarbeitungsvertrag oder Rückfragen zu Unterauftragsverarbeitern schreiben Sie uns."
        href="/kontakt"
        label="Kontakt aufnehmen"
      />
    </div>
  );
}
