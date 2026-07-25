import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { getAgentDefinition } from "@/server/agents/catalog";
import { CtaBanner, PageIntro, Section } from "@/components/shared/marketing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Lösungen nach Anwendungsfall",
  description:
    "Konkrete Abläufe: Posteingang, Follow-ups, Rechnungseingang, Meetings, Wissensfragen und Fristen.",
};

/**
 * Anwendungsfälle mit dem tatsächlichen Ablauf.
 *
 * Die Agenten-Slugs verweisen auf den Katalog; Namen und Rollen werden von
 * dort gelesen, damit die Seite nicht auseinanderläuft, wenn ein Agent
 * umbenannt wird.
 */
const useCases = [
  {
    id: "posteingang",
    title: "Der Posteingang läuft über",
    situation:
      "Hundert Nachrichten am Tag, darunter drei, die wirklich dringend sind — und eine, die nach Betrug aussieht.",
    flow: [
      "Eingehende Nachrichten werden gelesen und eingeordnet: Kategorie, Dringlichkeit, enthaltene Fristen.",
      "Verdächtige Nachrichten werden als solche markiert, nicht bearbeitet.",
      "Aus klaren Aufträgen entsteht ein Aufgabenvorschlag zur Freigabe.",
      "Ein Antwortentwurf wird vorbereitet — mit Platzhaltern dort, wo Fakten fehlen.",
    ],
    agents: ["email-triage", "email-draft", "task"],
    limit:
      "Versendet wird nichts ohne Freigabe. Der Entwurf benennt ausdrücklich, welche Angabe noch fehlt.",
  },
  {
    id: "followups",
    title: "Angebote bleiben unbeantwortet liegen",
    situation:
      "Ein Angebot ist raus, seit zwei Wochen kommt nichts zurück, und niemand hat Zeit nachzufassen.",
    flow: [
      "Offene Vorgänge werden regelmäßig auf ausbleibende Rückmeldung geprüft.",
      "Für passende Fälle entsteht ein höflicher Follow-up-Entwurf mit Begründung, warum jetzt.",
      "Kontakte mit Sperrvermerk werden übersprungen — ausnahmslos.",
      "Nach Ihrer Freigabe geht die Nachricht raus und der Vorgang wird aktualisiert.",
    ],
    agents: ["follow-up", "crm-agent"],
    limit:
      "Der Versand an Kunden ist eine Aktion mit Außenwirkung und damit freigabepflichtig — unabhängig von der eingestellten Stufe.",
  },
  {
    id: "rechnungen",
    title: "Rechnungseingang kostet jede Woche Stunden",
    situation:
      "Rechnungen kommen als PDF, per E-Mail, manchmal doppelt — und die Pflichtangaben fehlen häufiger als gedacht.",
    flow: [
      "Die Rechnung wird gelesen und strukturiert: Nummer, Lieferant, Betrag, Datum, Fälligkeit, IBAN.",
      "Fehlende Pflichtfelder werden benannt, nicht ergänzt oder geraten.",
      "Mögliche Doppelerfassungen werden gemeldet.",
      "Für lückenhafte Belege entsteht eine Prüfaufgabe mit konkreter Angabe, was fehlt.",
    ],
    agents: ["invoice-intake", "payment-monitoring"],
    limit:
      "Es wird nichts gezahlt und nichts gebucht. Der Agent bereitet vor, die Buchhaltung entscheidet.",
  },
  {
    id: "meetings",
    title: "Termine ohne Vorbereitung",
    situation:
      "Gleich ein Gespräch mit einer Kundin, und niemand weiß mehr, was beim letzten Mal offen blieb.",
    flow: [
      "Der anstehende Termin wird mit dem bisherigen Verlauf zusammengeführt.",
      "Ein Briefing entsteht: Vorgeschichte, offene Punkte, mögliche Fragen.",
      "Jede Aussage trägt ihre Quelle; Lücken werden ausdrücklich als Lücke markiert.",
    ],
    agents: ["meeting-preparation", "calendar"],
    limit:
      "Was nicht in Ihren Daten steht, steht auch nicht im Briefing. Ein leerer Punkt ist ehrlicher als eine erfundene Vorgeschichte.",
  },
  {
    id: "wissen",
    title: "Niemand findet die aktuelle Fassung",
    situation:
      '"Wie lang ist unsere Kündigungsfrist?" — die Antwort steht in einem Dokument, das niemand mehr findet.',
    flow: [
      "Interne Dokumente werden aufbereitet und durchsuchbar gemacht.",
      "Fragen werden ausschließlich aus freigegebenen Quellen beantwortet.",
      "Jede Antwort nennt das Dokument und die Fundstelle.",
      "Ohne Beleg lautet die Antwort, dass kein Beleg vorliegt.",
    ],
    agents: ["company-memory", "document-intelligence", "knowledge-search"],
    limit:
      "Wer für ein Dokument kein Zugriffsrecht hat, erhält den Inhalt nicht — auch nicht in zusammengefasster Form.",
  },
  {
    id: "fristen",
    title: "Fristen rutschen durch",
    situation:
      "Vertragsfristen, Kündigungstermine, wiederkehrende Pflichten — verteilt über E-Mails und Köpfe.",
    flow: [
      "Fristen werden aus Texten und Dokumenten erkannt und erfasst.",
      "Überfällige und bald fällige Vorgänge werden gemeldet.",
      "Die Prioritätenliste ordnet nach überfällig, Priorität und Fälligkeit — nachvollziehbar, nicht aus dem Bauch.",
    ],
    agents: ["deadline", "reminder", "chief-of-staff"],
    limit:
      "Erkannte Fristen ersetzen keine juristische Prüfung. Bei rechtlicher Tragweite gehört der Vorgang zu einer fachkundigen Person.",
  },
];

export default function UseCasePage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Lösungen"
        title="Sechs Abläufe, wie sie tatsächlich laufen"
        lead="Kein Marketingversprechen, sondern der Ablauf Schritt für Schritt — samt der Stelle, an der der Agent bewusst stehen bleibt."
      />

      <div className="space-y-6">
        {useCases.map((useCase) => (
          <Card key={useCase.id} id={useCase.id}>
            <CardHeader>
              <CardTitle>{useCase.title}</CardTitle>
              <CardDescription>{useCase.situation}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium">So läuft es ab</p>
                <ol className="space-y-1.5">
                  {useCase.flow.map((step, index) => (
                    <li key={step} className="flex gap-2.5 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums">
                        {index + 1}
                      </span>
                      <span className="text-muted-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Beteiligte Agenten</p>
                <div className="flex flex-wrap gap-2">
                  {useCase.agents.map((slug) => {
                    const def = getAgentDefinition(slug);
                    if (!def) return null;
                    return (
                      <Link key={slug} href={`/agenten/${slug}`}>
                        <Badge
                          variant="secondary"
                          className="transition-colors hover:bg-secondary/70"
                        >
                          {def.personaName} — {def.roleTitle}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-status-warning/40 bg-status-warning/8 p-3">
                <p className="text-sm">
                  <strong>Wo der Agent stehen bleibt:</strong>{" "}
                  <span className="text-muted-foreground">{useCase.limit}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Section title="Anderer Blickwinkel">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/loesungen/unternehmensgroesse">
              Nach Unternehmensgröße
              <ArrowRightIcon />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/agenten">Alle Agenten im Katalog</Link>
          </Button>
        </div>
      </Section>

      <CtaBanner
        title="Ihr Ablauf ist nicht dabei?"
        text="Der Konfigurator fragt nach Ihren Zeitfressern und schlägt passende Rollen vor."
      />
    </div>
  );
}
