import Link from "next/link";
import { CheckIcon, InfoIcon } from "lucide-react";
import { PLAN_SEEDS, yearlySavingsPercent } from "@/server/billing/plans";
import {
  DEFAULT_TIER_PRICES_CENTS,
  departments,
  getAgentsByDepartment,
} from "@/server/agents/catalog";
import { formatEuro, getAgentMonthlyPriceCents } from "@/server/billing/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  title: "Preise",
  description:
    "Plattformplan plus digitale Mitarbeiter — transparent, monatlich kündbar, mit Department-Paketen und Mengenrabatt.",
};

const tierLabels: Record<string, string> = {
  simple: "Einfach — klar abgegrenzte Routineaufgaben",
  advanced: "Fortgeschritten — mehrstufige Abläufe mit Kontext",
  complex: "Komplex — bereichsübergreifend, mit Bewertung und Priorisierung",
  chief: "Chief of Staff — koordiniert das gesamte digitale Team",
};

export default function PricingPage() {
  const bundles = Object.values(departments)
    .filter((d) => d.bundlePriceCents)
    .map((d) => {
      const agents = getAgentsByDepartment(d.slug);
      const individual = agents.reduce(
        (sum, a) => sum + getAgentMonthlyPriceCents(a),
        0,
      );
      return {
        slug: d.slug,
        name: d.name,
        agentCount: agents.length,
        individual,
        bundle: d.bundlePriceCents!,
        savings: individual - d.bundlePriceCents!,
      };
    });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-16 px-4 py-16">
      <header className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          Preise ohne Überraschungen
        </h1>
        <p className="text-lg text-muted-foreground">
          Sie zahlen einen Plattformplan und darauf jene digitalen Mitarbeiter,
          die Sie tatsächlich einsetzen. Kein Mindestvolumen, monatlich kündbar.
        </p>
      </header>

      {/* Pläne */}
      <section className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_SEEDS.map((p) => (
            <Card key={p.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{p.name}</CardTitle>
                  {p.key === "growth" ? (
                    <Badge variant="active">Beliebt</Badge>
                  ) : null}
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <p className="text-3xl font-semibold tabular-nums">
                    {formatEuro(p.monthlyPriceCents)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / Monat
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatEuro(p.yearlyPricePerMonthCents)} / Monat bei
                    Jahreszahlung ({yearlySavingsPercent(p)} % günstiger)
                  </p>
                  {p.setupFeeCents > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      zzgl. einmalig {formatEuro(p.setupFeeCents)} Einrichtung
                    </p>
                  ) : null}
                </div>
                <ul className="space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-status-active" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-auto" asChild>
                  <Link href="/konfigurator">Team zusammenstellen</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Alle Preise netto zzgl. gesetzlicher Umsatzsteuer. 14 Tage Testphase
          ohne Zahlungsmittel.
        </p>
      </section>

      {/* Agentenpreise */}
      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Was ein digitaler Mitarbeiter kostet
          </h2>
          <p className="text-muted-foreground">
            Der Preis richtet sich nach der Komplexität der Rolle — nicht nach
            der Zahl der Klicks.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategorie</TableHead>
              <TableHead className="text-right">Preis pro Monat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(
              Object.entries(DEFAULT_TIER_PRICES_CENTS) as [string, number][]
            ).map(([tier, cents]) => (
              <TableRow key={tier}>
                <TableCell>{tierLabels[tier] ?? tier}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatEuro(cents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-sm text-muted-foreground">
          Ab 5 gleichzeitig gebuchten Einzelagenten sinkt der Agentenpreis um
          10 %, ab 10 Agenten um 15 %. Im Plan enthaltene Agenten-Plätze werden
          zuerst verrechnet.
        </p>
      </section>

      {/* Department-Pakete */}
      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">
            Department-Pakete
          </h2>
          <p className="text-muted-foreground">
            Wer ein komplettes Department bucht, zahlt automatisch den
            günstigeren Paketpreis — es ist keine Aktion nötig.
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Agenten</TableHead>
              <TableHead className="text-right">Einzeln</TableHead>
              <TableHead className="text-right">Als Paket</TableHead>
              <TableHead className="text-right">Ersparnis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bundles.map((b) => (
              <TableRow key={b.slug}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {b.agentCount}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground line-through">
                  {formatEuro(b.individual)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatEuro(b.bundle)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-status-active">
                  {formatEuro(b.savings)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Ehrliche Hinweise */}
      <section className="space-y-4">
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Was im Preis enthalten ist — und was nicht</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              <li>
                Enthalten: Plattform, gebuchte Agenten, Wissensbasis, Freigaben,
                Protokollierung, Berichte, Demo-Connectoren, Webhooks, CSV.
              </li>
              <li>
                Verbrauchsabhängig begrenzt: Agentenläufe und KI-Kosten je Plan.
                Bei 80 % des Kontingents warnt die Anwendung, bei 100 % stoppen
                die Agenten, statt still weiterzulaufen.
              </li>
              <li>
                Nicht enthalten: Lizenzkosten Ihrer angebundenen Drittsysteme
                sowie individuelle Entwicklung.
              </li>
              <li>
                Sandbox-Testläufe zählen nicht gegen Ihr Kontingent — Testen ist
                kostenfrei.
              </li>
            </ul>
          </AlertDescription>
        </Alert>
      </section>

      <section className="rounded-2xl border bg-muted/30 p-8 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Unsicher, welches Team Sie brauchen?
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
          Der Konfigurator berechnet aus Ihren Antworten eine begründete
          Empfehlung inklusive Preis — ohne Registrierung.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/konfigurator">Zum Team-Konfigurator</Link>
        </Button>
      </section>
    </div>
  );
}
