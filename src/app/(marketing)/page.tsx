import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const automationLevels = [
  { level: 0, name: "Ausgeschaltet", text: "Der Agent führt keine Aufgaben aus." },
  { level: 1, name: "Beobachten", text: "Analysiert Daten und meldet Auffälligkeiten." },
  { level: 2, name: "Entwurf", text: "Erstellt Vorschläge oder Entwürfe." },
  { level: 3, name: "Freigabe erforderlich", text: "Bereitet Aktionen vor, führt sie erst nach menschlicher Freigabe aus." },
  { level: 4, name: "Autonom in Regeln", text: "Führt klar definierte risikoarme Aktionen selbst aus." },
  { level: 5, name: "Erweiterte Autonomie", text: "Nur für ausdrücklich erlaubte, getestete, reversible Aktionen." },
];

const departments = [
  { name: "AI Sales", text: "Lead-Recherche, Qualifizierung, Follow-ups, Angebote, CRM-Pflege und Reporting." },
  { name: "AI Office", text: "E-Mail-Triage, Antwortentwürfe, Kalender, Meetings, Aufgaben und Dokumente." },
  { name: "AI Finance Operations", text: "Rechnungseingang, Zahlungsüberwachung, Mahnentwürfe, Spesen und Berichte." },
  { name: "AI HR Operations", text: "Bewerbungsverwaltung, Interviews, Onboarding, Abwesenheiten und Feedback." },
  { name: "AI Customer Service", text: "Anfragen, Wissensbasis, Ticket-Routing, Eskalationen und Qualität." },
  { name: "AI Operations", text: "Prozesse, Fristen, Kapazitäten, Lieferanten, Projektstatus und Engpässe." },
  { name: "AI Knowledge", text: "Dokumentenintelligenz, Unternehmensgedächtnis, Recherche, SOPs und Suche." },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_60%)]"
        />
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-20 pt-24 text-center">
          <Badge variant="secondary" className="mb-6">
            Modulare digitale Mitarbeiter für Ihr Unternehmen
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            Your company has more work than people.
            <span className="mt-2 block text-primary">
              Build your digital workforce.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Wählen Sie spezialisierte KI-Mitarbeiter, verbinden Sie Ihre Systeme
            und automatisieren Sie wiederkehrende Unternehmensarbeit — mit
            klaren Berechtigungen, menschlichen Freigaben und vollständiger
            Kontrolle.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/konfigurator">
                Digitales Team zusammenstellen
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/demo">Interaktive Demo ansehen</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Nutzenversprechen */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <UsersIcon className="mb-2 size-6 text-primary" />
                <CardTitle>Echte digitale Mitarbeiter</CardTitle>
                <CardDescription>
                  Jeder Agent hat Rolle, Stellenbeschreibung, Fähigkeiten,
                  Berechtigungen, KPIs, Gedächtnis und ein revisionsfähiges
                  Aktivitätsprotokoll — keine anonymen Chatbots.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <SlidersHorizontalIcon className="mb-2 size-6 text-primary" />
                <CardTitle>Automatisierung in Stufen</CardTitle>
                <CardDescription>
                  Von reinem Beobachten bis zu regelbasierter Autonomie: Sie
                  bestimmen je Fähigkeit, wie selbstständig Ihr digitales Team
                  arbeitet.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <ShieldCheckIcon className="mb-2 size-6 text-primary" />
                <CardTitle>Kontrolle & Freigaben</CardTitle>
                <CardDescription>
                  Aktionen mit finanziellen, rechtlichen oder personellen Folgen
                  benötigen grundsätzlich menschliche Freigabe — nachvollziehbar
                  im Approval Center.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Departments */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Sieben Departments. Ein Team.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Buchen Sie einzelne Agenten oder komplette digitale Abteilungen —
            modular, konfigurierbar und jederzeit anpassbar.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <Card key={d.name} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{d.name}</CardTitle>
                <CardDescription>{d.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Chief of Staff</CardTitle>
              <CardDescription>
                Die zentrale Koordinationsinstanz: priorisiert, delegiert,
                bündelt Freigaben und erstellt Ihre Tages- und Wochenbriefings.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
        <div className="mt-8">
          <Button variant="outline" asChild>
            <Link href="/departments">
              Alle Departments ansehen
              <ArrowRightIcon />
            </Link>
          </Button>
        </div>
      </section>

      {/* Automatisierungsstufen */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              Sie behalten die Kontrolle — auf jeder Stufe.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Jede Fähigkeit jedes Agenten lässt sich einzeln auf eine von sechs
              Automatisierungsstufen einstellen.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {automationLevels.map((l) => (
              <div
                key={l.level}
                className="flex gap-4 rounded-xl border bg-card p-4"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {l.level}
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{l.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{l.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sicherheit */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Sicherheit und Datenschutz von Anfang an.
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                "Strikte Mandantentrennung mit Row Level Security auf Datenbankebene",
                "Agenten sehen nur ausdrücklich freigegebene Datenquellen und Tools",
                "Jeder Agentenlauf wird revisionsfähig protokolliert",
                "Menschliche Freigaben für risikoreiche Aktionen",
                "Verschlüsselte Speicherung von Integrations-Zugangsdaten",
                "Entwickelt nach Privacy by Design für europäische Anforderungen",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-status-active" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="mt-6" asChild>
              <Link href="/sicherheit">
                Sicherheitskonzept ansehen
                <LockKeyholeIcon />
              </Link>
            </Button>
          </div>
          <Card className="bg-muted/40">
            <CardContent className="p-8">
              <blockquote className="text-balance text-lg font-medium leading-relaxed">
                „WORKFORCE OS stellt Unternehmen ein modulares digitales Team
                bereit, das wiederkehrende Wissens- und Verwaltungsarbeit
                übernimmt, Chancen erkennt, Aufgaben vorbereitet und — innerhalb
                klarer Berechtigungen — selbstständig ausführt.“
              </blockquote>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 py-20 text-center">
          <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight">
            Stellen Sie Ihr digitales Team zusammen.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            In wenigen Minuten konfiguriert — mit Testlauf in der Sandbox, bevor
            ein Agent echte Systeme berührt.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/konfigurator">
                Digitales Team zusammenstellen
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register">Kostenlos registrieren</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
