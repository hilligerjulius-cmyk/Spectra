import Link from "next/link";
import { ArrowRightIcon, InfoIcon } from "lucide-react";
import { agentCatalog, departments } from "@/server/agents/catalog";
import { AUTOMATION_LEVELS } from "@/server/agents/catalog";
import { CtaBanner, PageIntro, Section } from "@/components/shared/marketing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Ressourcen",
  description:
    "Leitfäden zum Einstieg: Automatisierungsstufen richtig wählen, Freigaben organisieren, Wissensbasis aufbauen.",
};

const guides = [
  {
    title: "Welche Automatisierungsstufe wann?",
    lead: "Die häufigste Fehlentscheidung am Anfang ist zu viel Autonomie zu früh.",
    body: [
      "Beginnen Sie bei Stufe 2 (Entwurf). Sie sehen, was der Agent produzieren würde, ohne dass etwas passiert. Nach ein bis zwei Wochen wissen Sie, ob die Qualität trägt.",
      "Wechseln Sie dann auf Stufe 3 (Freigabe erforderlich). Der Agent bereitet vollständig vor, Sie entscheiden mit einem Klick. Das ist für die meisten Fähigkeiten der dauerhaft richtige Ort.",
      "Stufe 4 lohnt nur bei Aktionen, die risikoarm und reversibel sind — etwa eine interne Aufgabe anlegen. Für Versand an Kunden ist Stufe 4 ohnehin gesperrt.",
    ],
  },
  {
    title: "Freigaben so organisieren, dass sie nicht liegen bleiben",
    lead: "Eine wartende Freigabe, die niemand sieht, ist schlimmer als keine Automatisierung.",
    body: [
      "Weisen Sie jedem Agenten eine verantwortliche Person zu. Wartende Freigaben erreichen dann gezielt diese Person, nicht ein anonymes Postfach.",
      "Nutzen Sie die Tageszusammenfassung, wenn Einzelmeldungen störten. In-App bleiben Meldungen sofort sichtbar, die E-Mail kommt gebündelt.",
      "Sammelfreigaben sind bewusst auf gleichartige, risikoarme Aktionen begrenzt. Wenn Sie zehn Freigaben pauschal erteilen wollen, ist meist die Automatisierungsstufe falsch gewählt.",
    ],
  },
  {
    title: "Eine Wissensbasis, die tatsächlich hilft",
    lead: "Qualität der Antworten hängt fast vollständig an der Qualität der Dokumente.",
    body: [
      "Laden Sie zuerst die Dokumente hoch, nach denen tatsächlich gefragt wird: Verträge, Preislisten, Standardabläufe. Nicht alles auf einmal.",
      "Halten Sie je Thema eine gültige Fassung. Zwei widersprüchliche Versionen führen zu widersprüchlichen Antworten mit korrekter Quellenangabe.",
      "Setzen Sie Zugriffsbereiche bewusst. Ein Dokument mit Personaldaten gehört nicht in den offenen Bereich, auch wenn es die Antwortqualität erhöhen würde.",
    ],
  },
  {
    title: "Woran Sie merken, dass es funktioniert",
    lead: "Nicht an der Zahl der Läufe, sondern an drei anderen Werten.",
    body: [
      "Zustimmungsquote bei Freigaben: Liegt sie dauerhaft hoch, können Sie die Stufe erhöhen. Liegt sie niedrig, stimmt etwas an der Konfiguration oder den Datenquellen nicht.",
      "Median-Entscheidungsdauer: Steigt sie, erreichen Freigaben nicht die richtige Person.",
      "Überfällige Aufgaben: Sinkt die Zahl, wirkt die Automatisierung tatsächlich im Alltag — unabhängig davon, wie viele Läufe stattfanden.",
    ],
  },
];

export default function ResourcesPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-16 px-4 py-16">
      <PageIntro
        eyebrow="Ressourcen"
        title="Leitfäden aus der Praxis"
        lead="Vier Themen, bei denen die Erfahrung zeigt, dass die Entscheidung am Anfang den Unterschied macht."
      />

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Umfang in Zahlen</AlertTitle>
        <AlertDescription>
          {agentCatalog.length} Agenten in {Object.keys(departments).length}{" "}
          Departments, {Object.keys(AUTOMATION_LEVELS).length}{" "}
          Automatisierungsstufen je Fähigkeit. Die Detailbeschreibung jedes
          Agenten — Aufgaben, Grenzen, benötigte Quellen, Kennzahlen — steht im{" "}
          <Link href="/agenten" className="text-primary hover:underline">
            Agentenkatalog
          </Link>
          .
        </AlertDescription>
      </Alert>

      <div className="space-y-6">
        {guides.map((guide) => (
          <Card key={guide.title}>
            <CardHeader>
              <CardTitle>{guide.title}</CardTitle>
              <CardDescription>{guide.lead}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2.5">
                {guide.body.map((paragraph, index) => (
                  <li key={paragraph} className="flex gap-3 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs tabular-nums">
                      {index + 1}
                    </span>
                    <span className="text-muted-foreground">{paragraph}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <Section title="Weiter im Detail">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            {
              href: "/loesungen/anwendungsfall",
              title: "Sechs Abläufe im Detail",
              text: "Was Schritt für Schritt passiert — und wo der Agent stehen bleibt.",
            },
            {
              href: "/sicherheit",
              title: "Sicherheit & Berechtigungen",
              text: "Mandantentrennung, Rollen, Verschlüsselung, Prompt-Injection-Schutz.",
            },
            {
              href: "/datenschutz-produkt",
              title: "Datenschutz im Produkt",
              text: "Welche Daten wofür verarbeitet werden und was Sie einstellen können.",
            },
            {
              href: "/faq",
              title: "Häufige Fragen",
              text: "Auch die, deren Antwort „das kann die Plattform nicht“ lautet.",
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <p className="flex items-center gap-1.5 font-medium">
                {item.title}
                <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </Link>
          ))}
        </div>
      </Section>

      <CtaBanner
        title="Bereit für den ersten Agenten?"
        text="Der Konfigurator schlägt aus Ihren Antworten ein begründetes Team vor."
      />
    </div>
  );
}
