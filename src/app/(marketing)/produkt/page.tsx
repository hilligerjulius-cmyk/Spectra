import Link from "next/link";
import { CheckIcon, InfoIcon, XIcon } from "lucide-react";
import { AUTOMATION_LEVELS } from "@/server/agents/catalog";
import {
  CtaBanner,
  PageIntro,
  Section,
} from "@/components/shared/marketing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

export const metadata = {
  title: "Produkt",
  description:
    "Wie digitale Mitarbeiter arbeiten: Aufgaben, Werkzeuge, Berechtigungen, Freigaben und nachvollziehbare Protokolle.",
};

const lifecycle = [
  {
    step: "Auslöser",
    text: "Ein Ereignis, ein Zeitplan oder eine Person startet den Lauf.",
  },
  {
    step: "Daten holen",
    text: "Nur aus Quellen, die Sie für genau diesen Agenten freigegeben haben.",
  },
  {
    step: "Analysieren",
    text: "Der Agent bewertet die Lage und benennt, was er nicht weiß.",
  },
  {
    step: "Entwurf",
    text: "Die Aktion wird vollständig vorbereitet — Empfänger, Inhalt, Betrag.",
  },
  {
    step: "Prüfen",
    text: "Gegen Berechtigungen, Grenzen und Ausschlussregeln validieren.",
  },
  {
    step: "Freigeben",
    text: "Je Automatisierungsstufe entscheidet ein Mensch — oder nicht.",
  },
  {
    step: "Ausführen",
    text: "Genau die freigegebene Aktion, auch wenn Sie sie vorher bearbeitet haben.",
  },
  {
    step: "Protokollieren",
    text: "Schritte, Quellen, Kosten und Dauer bleiben nachvollziehbar.",
  },
];

const isNot = [
  "Ein Chatbot, der Fragen beantwortet und danach nichts tut.",
  "Ein System, das Ihr Unternehmen selbstständig führt.",
  "Ein Ersatz für rechtliche, steuerliche oder medizinische Beratung.",
  "Eine Blackbox, deren Entscheidungen Sie nicht nachvollziehen können.",
];

const isThis = [
  "Spezialisierte Rollen mit Stellenbeschreibung, Werkzeugen und Grenzen.",
  "Aktionen, die vorbereitet und erst nach Ihrer Entscheidung ausgeführt werden.",
  "Datenzugriff nur dort, wo Sie ihn ausdrücklich erteilt haben.",
  "Ein Protokoll je Lauf: welche Quelle, welcher Schritt, welche Kosten.",
];

export default function ProductPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Produkt"
        title="Digitale Mitarbeiter, nicht Chatbots"
        lead="Jeder Agent hat eine Rolle, klar begrenzte Werkzeuge und eine Automatisierungsstufe, die Sie bestimmen. Was Wirkung nach außen hat, entscheidet ein Mensch."
      />

      <Section
        title="Was ein Lauf durchläuft"
        description="Acht Phasen, jede protokolliert. Kein Schritt wird übersprungen, auch nicht bei hoher Automatisierung."
      >
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {lifecycle.map((phase, index) => (
            <li key={phase.step} className="rounded-lg border p-4">
              <Badge variant="secondary" className="mb-2">
                {index + 1}
              </Badge>
              <p className="font-medium">{phase.step}</p>
              <p className="mt-1 text-sm text-muted-foreground">{phase.text}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        title="Automatisierungsstufen"
        description="Je Fähigkeit einstellbar. Der Katalog setzt zusätzlich eine Obergrenze, die sich nicht überschreiben lässt — etwa beim Versand an Kunden."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Stufe</TableHead>
              <TableHead className="w-56">Bezeichnung</TableHead>
              <TableHead>Bedeutung</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(AUTOMATION_LEVELS).map(([level, def]) => (
              <TableRow key={level}>
                <TableCell className="font-mono tabular-nums">{level}</TableCell>
                <TableCell className="font-medium">{def.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {def.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Voreinstellung ist Zurückhaltung</AlertTitle>
          <AlertDescription>
            Neue Agenten starten in der Sandbox. Erst nach einem bestandenen
            Testlauf lassen sie sich aktivieren, und Fähigkeiten mit hohem
            Risiko enden grundsätzlich bei Stufe 3 — der Freigabe durch einen
            Menschen.
          </AlertDescription>
        </Alert>
      </Section>

      <Section title="Was die Plattform ist — und was nicht">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Das leistet sie</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {isThis.map((item) => (
                  <li key={item} className="flex gap-2 text-sm">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-status-active" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Das leistet sie nicht</CardTitle>
              <CardDescription>
                Wir nennen die Grenzen lieber vorher als hinterher.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {isNot.map((item) => (
                  <li key={item} className="flex gap-2 text-sm">
                    <XIcon className="mt-0.5 size-4 shrink-0 text-status-error" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section
        title="Wissen mit Quellenangabe"
        description="Agenten antworten aus Ihren Dokumenten — und sagen ausdrücklich, wenn eine Frage darin nicht belegt ist."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Nur freigegebene Quellen",
              text: "Dokumente tragen einen Zugriffsbereich. Wer kein Recht hat, erhält den Inhalt nicht — auch nicht zusammengefasst.",
            },
            {
              title: "Belegpflicht",
              text: "Jede Antwort nennt die Fundstelle. Zitate, die nicht aus einer gelieferten Quelle stammen, werden verworfen.",
            },
            {
              title: "Lücken werden benannt",
              text: 'Ohne Beleg lautet die Antwort "dazu liegt kein Beleg vor" — nicht eine plausibel klingende Erfindung.',
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

      <Section title="Weiterlesen">
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/departments", label: "Die sieben Departments" },
            { href: "/agenten", label: "Alle Agenten im Katalog" },
            { href: "/sicherheit", label: "Sicherheit & Berechtigungen" },
            { href: "/integrationen", label: "Verfügbare Anbindungen" },
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
        title="Passt das zu Ihrem Unternehmen?"
        text="Der Konfigurator fragt nach Ihren Zeitfressern und schlägt ein begründetes Team vor — ohne Registrierung."
      />
    </div>
  );
}
