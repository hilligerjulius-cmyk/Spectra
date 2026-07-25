import Link from "next/link";
import { InfoIcon, MailIcon } from "lucide-react";
import { PageIntro, Placeholder, Section } from "@/components/shared/marketing";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Kontakt",
  description: "Wie Sie uns erreichen — und was Sie dabei am besten mitschicken.",
};

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-12 px-4 py-16">
      <PageIntro
        eyebrow="Kontakt"
        title="Schreiben Sie uns"
        lead="Technische Rückfragen beantworten wir konkret — auch die zu Grenzen und offenen Punkten."
      />

      <Alert variant="warning">
        <InfoIcon />
        <AlertTitle>Kein Kontaktformular — mit Absicht</AlertTitle>
        <AlertDescription>
          Ein Formular, das Nachrichten annimmt und nirgends zustellt, wäre
          schlimmer als keines. Solange kein Postfach für eingehende Anfragen
          eingerichtet ist, führt diese Seite bewusst nur die Adressen auf, die
          der Betreiber eintragen muss. Ohne konfigurierten SMTP-Zugang
          versendet die Plattform ohnehin keine E-Mails, sondern legt sie
          einsehbar im Postausgang ab.
        </AlertDescription>
      </Alert>

      <Section title="Ansprechpunkte">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Allgemeine Anfragen",
              placeholder: "kontakt@ihre-domain.de",
              text: "Fragen zum Produkt, zu Plänen und zur Einführung.",
            },
            {
              title: "Technischer Support",
              placeholder: "support@ihre-domain.de",
              text: "Störungen und Fragen zu bestehenden Installationen.",
            },
            {
              title: "Datenschutz",
              placeholder: "datenschutz@ihre-domain.de",
              text: "Auftragsverarbeitungsvertrag, Unterauftragsverarbeiter, Betroffenenrechte.",
            },
            {
              title: "Sicherheit",
              placeholder: "security@ihre-domain.de",
              text: "Meldung von Schwachstellen. Bitte mit Reproduktionsschritten.",
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <MailIcon className="size-4" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.text}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  <Placeholder>{item.placeholder}</Placeholder>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        title="Was hilft uns, schnell zu antworten"
        description="Je konkreter die Angaben, desto weniger Rückfragen."
      >
        <ul className="space-y-2">
          {[
            "Bei Störungen: Name des Agenten, Fähigkeit und der Zeitpunkt des Laufs. Die Lauf-Kennung finden Sie unter Activity.",
            "Bei Fragen zur Anbindung: welches System, welche Richtung (lesen oder schreiben), welche Datenmenge.",
            "Bei Datenschutzfragen: ob es um einen Auftragsverarbeitungsvertrag, ein Auskunftsersuchen oder eine Löschung geht.",
            "Bei Schwachstellen: Reproduktionsschritte und betroffene Version. Bitte keine Kundendaten mitschicken.",
          ].map((item) => (
            <li key={item} className="rounded-lg border p-3 text-sm">
              {item}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Vorher vielleicht schon beantwortet">
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/faq", label: "Häufige Fragen" },
            { href: "/sicherheit", label: "Sicherheit" },
            { href: "/datenschutz-produkt", label: "Datenschutz im Produkt" },
            { href: "/integrationen", label: "Verfügbare Anbindungen" },
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
    </div>
  );
}
