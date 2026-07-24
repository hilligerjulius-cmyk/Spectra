"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  InfoIcon,
  SaveIcon,
  XIcon,
} from "lucide-react";
import {
  computeConfiguratorResult,
  type ConfiguratorResult,
} from "@/server/configurator/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MultiChips, SingleChips } from "@/components/shared/choice-chips";
import {
  automatisierungOptions,
  departmentOptions,
  groessenOptions as groessen,
  softwareOptions,
  umsatzOptions,
  vorgaengeOptions,
  zeitfresserOptions,
} from "@/server/configurator/options";

/* ---------- Wizard ---------- */

const TOTAL_STEPS = 5;

export function ConfiguratorWizard() {
  const [step, setStep] = React.useState(0);
  const [branche, setBranche] = React.useState("");
  const [groesse, setGroesse] = React.useState("");
  const [software, setSoftware] = React.useState<string[]>([]);
  const [zeitfresser, setZeitfresser] = React.useState<string[]>([]);
  const [umsatz, setUmsatz] = React.useState<string[]>([]);
  const [depts, setDepts] = React.useState<string[]>([]);
  const [automatisierung, setAutomatisierung] = React.useState("");
  const [vorgaenge, setVorgaenge] = React.useState("");
  const [datenschutz, setDatenschutz] = React.useState("");
  const [removed, setRemoved] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<ConfiguratorResult | null>(null);
  const [pending, startTransition] = React.useTransition();

  function toggle(list: string[], set: (v: string[]) => void, key: string) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  function answers() {
    return {
      branche,
      unternehmensgroesse: groesse,
      software,
      zeitfresser,
      umsatzverluste: umsatz,
      departments: depts,
      automatisierungsgrad: automatisierung,
      vorgaenge,
      datenschutz,
    };
  }

  function compute(removedOverride: string[]) {
    startTransition(async () => {
      try {
        const res = await computeConfiguratorResult(answers(), {
          added: [],
          removed: removedOverride,
        });
        setResult(res);
      } catch {
        toast.error("Berechnung fehlgeschlagen. Bitte erneut versuchen.");
      }
    });
  }

  function next() {
    if (step === TOTAL_STEPS - 1) {
      compute(removed);
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function removeAgent(slug: string) {
    const nextRemoved = [...removed, slug];
    setRemoved(nextRemoved);
    compute(nextRemoved);
  }

  function restoreAgent(slug: string) {
    const nextRemoved = removed.filter((s) => s !== slug);
    setRemoved(nextRemoved);
    compute(nextRemoved);
  }

  function saveQuote() {
    if (!result) return;
    try {
      localStorage.setItem(
        "workforce-os-konfigurator",
        JSON.stringify({ answers: answers(), removed, savedAt: new Date().toISOString() }),
      );
      toast.success("Konfiguration lokal gespeichert. Sie können jederzeit zurückkehren.");
    } catch {
      toast.error("Speichern nicht möglich (Browser-Speicher blockiert).");
    }
  }

  function loadSavedQuote() {
    try {
      const stored = localStorage.getItem("workforce-os-konfigurator");
      if (!stored) {
        toast.info("Keine gespeicherte Konfiguration gefunden.");
        return;
      }
      const parsed = JSON.parse(stored) as {
        answers?: Record<string, unknown>;
        removed?: string[];
      };
      const a = parsed.answers ?? {};
      if (typeof a.branche === "string") setBranche(a.branche);
      if (typeof a.unternehmensgroesse === "string") setGroesse(a.unternehmensgroesse);
      if (Array.isArray(a.software)) setSoftware(a.software as string[]);
      if (Array.isArray(a.zeitfresser)) setZeitfresser(a.zeitfresser as string[]);
      if (Array.isArray(a.umsatzverluste)) setUmsatz(a.umsatzverluste as string[]);
      if (Array.isArray(a.departments)) setDepts(a.departments as string[]);
      if (typeof a.automatisierungsgrad === "string") setAutomatisierung(a.automatisierungsgrad as never);
      if (typeof a.vorgaenge === "string") setVorgaenge(a.vorgaenge as never);
      if (typeof a.datenschutz === "string") setDatenschutz(a.datenschutz as never);
      if (Array.isArray(parsed.removed)) setRemoved(parsed.removed);
      toast.success("Gespeicherte Konfiguration geladen.");
    } catch {
      toast.error("Gespeicherte Konfiguration konnte nicht gelesen werden.");
    }
  }

  /* ---------- Ergebnis-Ansicht ---------- */
  if (step >= TOTAL_STEPS) {
    return (
      <div className="space-y-6">
        {pending || !result ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Spinner className="size-6" />
            <p className="text-sm text-muted-foreground">
              Ihr digitales Team wird zusammengestellt…
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(TOTAL_STEPS - 1)}>
                <ArrowLeftIcon /> Antworten anpassen
              </Button>
              <Button variant="outline" onClick={saveQuote}>
                <SaveIcon /> Konfiguration speichern
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>
                  Ihr empfohlenes Team: {result.selectedSlugs.length} Agenten
                </CardTitle>
                <CardDescription>
                  Jede Empfehlung mit Begründung. Entfernen Sie Agenten oder
                  passen Sie Ihre Antworten an — der Preis wird serverseitig neu
                  berechnet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.recommendation.agents
                  .filter((a) => result.selectedSlugs.includes(a.slug))
                  .map((agent, i) => (
                    <div
                      key={agent.slug}
                      className="flex items-start justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          <span className="mr-2 text-xs text-muted-foreground">
                            {i + 1}.
                          </span>
                          {agent.personaName} — {agent.roleTitle}
                          <Badge variant="secondary" className="ml-2">
                            {agent.departmentName}
                          </Badge>
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {agent.reasons.map((r) => (
                            <li
                              key={r}
                              className="flex gap-2 text-sm text-muted-foreground"
                            >
                              <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-status-active" />
                              {r}
                            </li>
                          ))}
                        </ul>
                        {agent.requiredIntegrations.length > 0 ? (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Benötigt: {agent.requiredIntegrations.join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${agent.personaName} entfernen`}
                        onClick={() => removeAgent(agent.slug)}
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}

                {removed.length > 0 ? (
                  <div className="rounded-lg border border-dashed p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Entfernt:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {removed.map((slug) => (
                        <Button
                          key={slug}
                          variant="outline"
                          size="sm"
                          onClick={() => restoreAgent(slug)}
                        >
                          {slug} wiederherstellen
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Monatspreis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {result.pricing.bundles.map((b) => (
                    <div key={b.department} className="flex justify-between">
                      <span>
                        {b.name} (Paket)
                        <Badge variant="active" className="ml-2">
                          spart{" "}
                          {((b.individualSumCents - b.bundleCents) / 100).toFixed(0)}{" "}
                          €
                        </Badge>
                      </span>
                      <span className="tabular-nums">
                        {(b.bundleCents / 100).toFixed(0)} €
                      </span>
                    </div>
                  ))}
                  {result.pricing.items.map((item) => (
                    <div key={item.slug} className="flex justify-between">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="tabular-nums">
                        {(item.monthlyCents / 100).toFixed(0)} €
                      </span>
                    </div>
                  ))}
                  {result.pricing.volumeDiscountCents > 0 ? (
                    <div className="flex justify-between text-status-active">
                      <span>
                        Mengenrabatt ({result.pricing.volumeDiscountPercent} %)
                      </span>
                      <span className="tabular-nums">
                        −{(result.pricing.volumeDiscountCents / 100).toFixed(0)} €
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Gesamt / Monat</span>
                    <span className="tabular-nums">
                      {(result.pricing.totalMonthlyCents / 100).toFixed(0)} €
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zzgl. Plattform-Grundgebühr je nach Plan. Alle Preise netto.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Einschätzung & nächste Schritte
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    <span className="font-medium">
                      Mögliche Zeitersparnis: bis zu{" "}
                      {result.recommendation.totalEstimatedHoursSaved} Stunden/Monat.
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Konservative Schätzung auf Basis typischer Einsatzszenarien —
                    kein garantiertes Ergebnis. Die tatsächliche Ersparnis hängt
                    von Ihren Prozessen, Datenquellen und Automatisierungsstufen
                    ab.
                  </p>
                  <p>
                    Einrichtungsaufwand:{" "}
                    <Badge variant="outline">
                      {result.recommendation.setupEffortSummary === "low"
                        ? "gering"
                        : result.recommendation.setupEffortSummary === "medium"
                          ? "mittel"
                          : "hoch"}
                    </Badge>
                  </p>
                  {result.recommendation.requiredIntegrations.length > 0 ? (
                    <p>
                      Benötigte Integrationen:{" "}
                      {result.recommendation.requiredIntegrations.join(", ")}
                    </p>
                  ) : null}
                  {result.recommendation.privacyNote ? (
                    <Alert variant="info">
                      <InfoIcon />
                      <AlertTitle>Datenschutz-Hinweis</AlertTitle>
                      <AlertDescription>
                        {result.recommendation.privacyNote}
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">
                  Jetzt starten — Team einrichten
                  <ArrowRightIcon />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/demo">Demo ansehen</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ---------- Fragen-Schritte ---------- */
  const steps: { title: string; description: string; content: React.ReactNode; canNext: boolean }[] = [
    {
      title: "Ihr Unternehmen",
      description: "Branche und Größe helfen uns bei passenden Empfehlungen.",
      canNext: groesse !== "",
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="branche">Branche (optional)</Label>
            <Input
              id="branche"
              value={branche}
              onChange={(e) => setBranche(e.target.value)}
              placeholder="z. B. Agentur, Kanzlei, Handwerk, SaaS…"
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label>Unternehmensgröße (Mitarbeiter)</Label>
            <SingleChips options={groessen} selected={groesse} onSelect={setGroesse} />
          </div>
        </div>
      ),
    },
    {
      title: "Vorhandene Software",
      description: "Welche Systeme nutzen Sie bereits? (Mehrfachauswahl)",
      canNext: true,
      content: (
        <MultiChips
          options={softwareOptions.map((s) => ({ key: s, label: s }))}
          selected={software}
          onToggle={(k) => toggle(software, setSoftware, k)}
        />
      ),
    },
    {
      title: "Zeitfresser & Umsatzverluste",
      description: "Wo geht heute am meisten verloren? (Mehrfachauswahl)",
      canNext: zeitfresser.length > 0 || umsatz.length > 0,
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Größte Zeitfresser</Label>
            <MultiChips
              options={zeitfresserOptions}
              selected={zeitfresser}
              onToggle={(k) => toggle(zeitfresser, setZeitfresser, k)}
            />
          </div>
          <div className="space-y-2">
            <Label>Wo entgehen Ihnen Umsätze?</Label>
            <MultiChips
              options={umsatzOptions}
              selected={umsatz}
              onToggle={(k) => toggle(umsatz, setUmsatz, k)}
            />
          </div>
        </div>
      ),
    },
    {
      title: "Departments & Arbeitsweise",
      description: "Welche Bereiche sind Ihnen am wichtigsten?",
      canNext: automatisierung !== "",
      content: (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Wichtigste Departments (optional, Mehrfachauswahl)</Label>
            <MultiChips
              options={departmentOptions}
              selected={depts}
              onToggle={(k) => toggle(depts, setDepts, k)}
            />
          </div>
          <div className="space-y-2">
            <Label>Gewünschter Automatisierungsgrad</Label>
            <SingleChips
              options={automatisierungOptions}
              selected={automatisierung}
              onSelect={setAutomatisierung}
            />
          </div>
          <div className="space-y-2">
            <Label>Monatliche Vorgänge (E-Mails, Belege, Tickets …)</Label>
            <SingleChips
              options={vorgaengeOptions}
              selected={vorgaenge}
              onSelect={setVorgaenge}
            />
          </div>
        </div>
      ),
    },
    {
      title: "Datenschutz",
      description: "Wie hoch sind Ihre Datenschutzanforderungen?",
      canNext: datenschutz !== "",
      content: (
        <SingleChips
          options={[
            { key: "standard", label: "Standard (DSGVO-konform)" },
            { key: "hoch", label: "Hoch (z. B. Kanzlei, Gesundheitsbereich)" },
          ]}
          selected={datenschutz}
          onSelect={setDatenschutz}
        />
      ),
    },
  ];

  const current = steps[step]!;

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex items-center justify-between gap-2">
          <Progress
            value={((step + 1) / (TOTAL_STEPS + 1)) * 100}
            aria-label={`Schritt ${step + 1} von ${TOTAL_STEPS}`}
          />
          {step === 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={loadSavedQuote}
            >
              Gespeicherte laden
            </Button>
          ) : null}
        </div>
        <CardTitle>{current.title}</CardTitle>
        <CardDescription>{current.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {current.content}
        <div className="flex justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeftIcon /> Zurück
          </Button>
          <Button onClick={next} disabled={!current.canNext}>
            {step === TOTAL_STEPS - 1 ? "Team berechnen" : "Weiter"}
            <ArrowRightIcon />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
