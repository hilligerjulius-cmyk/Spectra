import Link from "next/link";
import { CtaBanner, PageIntro, Section } from "@/components/shared/marketing";
import { PLAN_SEEDS } from "@/server/billing/plans";
import { formatEuro } from "@/server/billing/pricing";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Lösungen nach Unternehmensgröße",
  description:
    "Womit Selbstständige, kleine Teams, Mittelstand und größere Organisationen sinnvoll starten.",
};

const segments = [
  {
    size: "1–4 Personen",
    title: "Selbstständige und Kleinstteams",
    plan: "starter",
    pain: "Alles landet bei einer Person: Posteingang, Angebote, Rechnungen, Termine.",
    start: ["email-triage", "task", "invoice-intake"],
    startLabels: ["E-Mail-Triage", "Aufgaben-Agent", "Rechnungseingang"],
    advice:
      "Fangen Sie mit einem einzigen Agenten an, der Ihren größten Zeitfresser übernimmt. Stufe 2 oder 3 — Entwürfe und Freigaben — genügt am Anfang und schafft Vertrauen.",
  },
  {
    size: "5–25 Personen",
    title: "Wachsende Teams",
    plan: "growth",
    pain: "Zuständigkeiten verschwimmen, Follow-ups bleiben liegen, Wissen steckt in Köpfen.",
    start: ["follow-up", "meeting-preparation", "company-memory"],
    startLabels: ["Follow-up", "Meetingvorbereitung", "Unternehmensgedächtnis"],
    advice:
      "Ab etwa vier Agenten lohnt der Chief of Staff: Er bündelt Freigaben und erstellt ein Tagesbriefing aus Ihren echten Daten. Vergeben Sie jetzt auch Rollen — nicht jede Person muss Freigaben erteilen dürfen.",
  },
  {
    size: "26–100 Personen",
    title: "Etablierter Mittelstand",
    plan: "scale",
    pain: "Mehrere Bereiche mit eigenen Abläufen; Berichte kosten Zeit, Fristen werden knapp.",
    start: ["sales", "finance", "operations"],
    startLabels: ["AI Sales", "AI Finance Operations", "AI Operations"],
    advice:
      "Hier tragen komplette Departments. Der Paketpreis greift automatisch, sobald ein Department vollständig gebucht ist. Achten Sie auf klare Freigabeketten je Bereich.",
  },
  {
    size: "über 100 Personen",
    title: "Größere Organisationen",
    plan: "enterprise",
    pain: "Anforderungen an Nachvollziehbarkeit, Datenschutz und Betrieb dominieren die Auswahl.",
    start: ["knowledge", "customer-service", "hr"],
    startLabels: ["AI Knowledge", "AI Customer Service", "AI HR Operations"],
    advice:
      "Beginnen Sie mit einem klar abgegrenzten Bereich als Pilot, mit Automatisierungsstufe 2 oder 3 und engen Datenfreigaben. Erst nach belegten Ergebnissen ausweiten.",
  },
];

export default function CompanySizePage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Lösungen"
        title="Womit Sie sinnvoll starten"
        lead="Die Plattform ist dieselbe. Was sich unterscheidet, ist die Reihenfolge — und wie viel Autonomie am Anfang angemessen ist."
      />

      <div className="space-y-6">
        {segments.map((segment) => {
          const plan = PLAN_SEEDS.find((p) => p.key === segment.plan)!;
          return (
            <Card key={segment.size}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      {segment.size}
                    </Badge>
                    <CardTitle>{segment.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {segment.pain}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Passender Plan
                    </p>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      ab {formatEuro(plan.yearlyPricePerMonthCents)}/Monat
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Sinnvoller Einstieg</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {segment.startLabels.map((label) => (
                      <Badge key={label} variant="outline">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {segment.advice}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Section
        title="Was für alle Größen gilt"
        description="Unabhängig davon, wie groß Ihr Unternehmen ist."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            "Jeder Agent beginnt in der Sandbox und wird erst nach bestandenem Testlauf aktiv.",
            "Wirksame Aktionen nach außen bleiben freigabepflichtig — auch auf hoher Stufe.",
            "Ein Agent sieht nur Datenquellen, die Sie ihm ausdrücklich erlauben.",
            "Jeder Lauf ist mit Schritten, Quellen und Kosten nachvollziehbar.",
          ].map((item) => (
            <li key={item} className="rounded-lg border p-3 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Anderer Blickwinkel">
        <div className="flex flex-wrap gap-3">
          {[
            {
              href: "/loesungen/anwendungsfall",
              label: "Nach Anwendungsfall statt nach Größe",
            },
            { href: "/departments", label: "Die sieben Departments" },
            { href: "/preise", label: "Preise im Detail" },
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
        title="Lieber konkret als allgemein?"
        text="Der Konfigurator berechnet aus Ihren Antworten eine begründete Empfehlung mit Preis."
      />
    </div>
  );
}
