"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  FlaskConicalIcon,
  InfoIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import {
  activateTestedAgents,
  createSelectedAgents,
  finishOnboarding,
  runSandboxForAll,
  saveOnboardingStep,
  type OnboardingActionResult,
} from "@/server/onboarding/actions";
import { selectPlan } from "@/server/billing/actions";
import { MultiChips, SingleChips } from "@/components/shared/choice-chips";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface StepDef {
  key: string;
  index: number;
  title: string;
  description: string;
  optional: boolean;
}

export interface RecommendedAgentView {
  slug: string;
  personaName: string;
  roleTitle: string;
  departmentName: string;
  reasons: string[];
  requiredIntegrations: string[];
  monthlyCents: number;
}

export interface InstanceView {
  id: string;
  slug: string;
  displayName: string;
  status: string;
  sandboxPassed: boolean;
}

export interface PlanChoice {
  key: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPricePerMonthCents: number;
  includedAgentSeats: number;
  includedRuns: number;
}

export interface ConnectorChoice {
  key: string;
  name: string;
  status: "implemented" | "credentials_required" | "planned";
  connected: boolean;
}

export interface SetupWizardProps {
  steps: StepDef[];
  initialStep: number;
  completedSteps: string[];
  organizationName: string;
  answers: {
    branche: string;
    unternehmensgroesse: string;
    software: string[];
    zeitfresser: string[];
    umsatzverluste: string[];
    departments: string[];
    automatisierungsgrad: string;
    vorgaenge: string;
    datenschutz: string;
  };
  recommended: RecommendedAgentView[];
  selectedAgents: string[];
  instances: InstanceView[];
  plans: PlanChoice[];
  currentPlanKey: string;
  currentInterval: "monthly" | "yearly";
  connectors: ConnectorChoice[];
  knowledgeDocumentCount: number;
  teamMemberCount: number;
  monthlyTotalCents: number;
  canManageBilling: boolean;
  options: {
    groessen: readonly string[];
    software: readonly string[];
    zeitfresser: { key: string; label: string }[];
    umsatz: { key: string; label: string }[];
    departments: { key: string; label: string }[];
    automatisierung: { key: string; label: string }[];
    vorgaenge: readonly string[];
  };
}

function euro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function SetupWizard(props: SetupWizardProps) {
  const router = useRouter();
  const { steps, options } = props;
  const [stepIndex, setStepIndex] = React.useState(props.initialStep);
  const [pending, setPending] = React.useState(false);

  // Antworten
  const [branche, setBranche] = React.useState(props.answers.branche);
  const [groesse, setGroesse] = React.useState(
    props.answers.unternehmensgroesse,
  );
  const [software, setSoftware] = React.useState<string[]>(
    props.answers.software,
  );
  const [zeitfresser, setZeitfresser] = React.useState<string[]>(
    props.answers.zeitfresser,
  );
  const [umsatz, setUmsatz] = React.useState<string[]>(
    props.answers.umsatzverluste,
  );
  const [depts, setDepts] = React.useState<string[]>(props.answers.departments);
  const [automatisierung, setAutomatisierung] = React.useState(
    props.answers.automatisierungsgrad,
  );
  const [vorgaenge, setVorgaenge] = React.useState(props.answers.vorgaenge);
  const [datenschutz, setDatenschutz] = React.useState(props.answers.datenschutz);

  const [selected, setSelected] = React.useState<string[]>(
    props.selectedAgents.length > 0
      ? props.selectedAgents
      : props.recommended.map((a) => a.slug),
  );
  const [yearly, setYearly] = React.useState(props.currentInterval === "yearly");
  const [planKey, setPlanKey] = React.useState(props.currentPlanKey);
  const [sandboxDetails, setSandboxDetails] = React.useState<
    { name: string; ok: boolean; message: string }[] | null
  >(null);

  const step = steps[stepIndex - 1]!;
  const isLast = stepIndex === steps.length;

  function toggle(
    list: string[],
    set: (v: string[]) => void,
    key: string,
  ) {
    set(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function persist(nextStep: number) {
    return saveOnboardingStep({
      stepKey: step.key,
      nextStep,
      answers: {
        branche,
        unternehmensgroesse: groesse as never,
        software,
        zeitfresser,
        umsatzverluste: umsatz,
        departments: depts,
        automatisierungsgrad: automatisierung as never,
        vorgaenge: vorgaenge as never,
        datenschutz: datenschutz as never,
      },
      selectedAgents: selected,
    });
  }

  async function goNext() {
    setPending(true);
    const next = Math.min(stepIndex + 1, steps.length);
    const result = await persist(next);
    setPending(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setStepIndex(next);
    router.refresh();
  }

  async function run(
    action: () => Promise<OnboardingActionResult>,
    onSuccess?: (r: OnboardingActionResult) => void,
  ) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (result.ok) {
      toast.success(result.message);
      onSuccess?.(result);
      router.refresh();
    } else {
      toast.error(result.message);
      onSuccess?.(result);
    }
  }

  const untestedCount = props.instances.filter((i) => !i.sandboxPassed).length;
  const testedIds = props.instances
    .filter((i) => i.sandboxPassed && i.status !== "active")
    .map((i) => i.id);

  /* ---------- Schrittinhalte ---------- */

  function renderStepBody() {
    switch (step.key) {
      case "welcome":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sie richten das digitale Team für{" "}
              <strong className="text-foreground">
                {props.organizationName}
              </strong>{" "}
              ein. Der Assistent führt Sie durch {steps.length} Schritte. Sie
              können jederzeit unterbrechen — der Fortschritt wird gespeichert.
            </p>
            <Alert variant="info">
              <ShieldCheckIcon />
              <AlertTitle>Was diese Plattform leistet — und was nicht</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li>
                    Digitale Mitarbeiter unterstützen Ihr Team. Sie ersetzen
                    keine rechtliche, steuerliche oder medizinische Beratung.
                  </li>
                  <li>
                    Aktionen mit finanzieller, rechtlicher, personeller oder
                    reputationsbezogener Wirkung erfordern grundsätzlich eine
                    menschliche Freigabe.
                  </li>
                  <li>
                    Agenten greifen ausschließlich auf Daten und Werkzeuge zu,
                    für die sie ausdrücklich freigegeben sind.
                  </li>
                  <li>
                    Jeder Lauf wird nachvollziehbar protokolliert und lässt sich
                    abbrechen.
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>
        );

      case "company":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="branche">Branche</Label>
              <Input
                id="branche"
                value={branche}
                onChange={(e) => setBranche(e.target.value)}
                placeholder="z. B. IT-Dienstleistung, Handwerk, Agentur"
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label>Mitarbeitende</Label>
              <SingleChips
                options={options.groessen}
                selected={groesse}
                onSelect={setGroesse}
              />
            </div>
            <div className="space-y-2">
              <Label>Eingesetzte Software</Label>
              <MultiChips
                options={options.software.map((s) => ({ key: s, label: s }))}
                selected={software}
                onToggle={(k) => toggle(software, setSoftware, k)}
              />
              <p className="text-xs text-muted-foreground">
                Die Angabe steuert Empfehlungen. Eine Anbindung entsteht dadurch
                nicht — Integrationen verbinden Sie in Schritt 7.
              </p>
            </div>
          </div>
        );

      case "pain-points":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Wo geht Zeit verloren?</Label>
              <MultiChips
                options={options.zeitfresser}
                selected={zeitfresser}
                onToggle={(k) => toggle(zeitfresser, setZeitfresser, k)}
              />
            </div>
            <div className="space-y-2">
              <Label>Wo geht Umsatz verloren?</Label>
              <MultiChips
                options={options.umsatz}
                selected={umsatz}
                onToggle={(k) => toggle(umsatz, setUmsatz, k)}
              />
            </div>
            <div className="space-y-2">
              <Label>Vorgänge pro Monat</Label>
              <SingleChips
                options={options.vorgaenge}
                selected={vorgaenge}
                onSelect={setVorgaenge}
              />
            </div>
          </div>
        );

      case "departments":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Bereiche</Label>
              <MultiChips
                options={options.departments}
                selected={depts}
                onToggle={(k) => toggle(depts, setDepts, k)}
              />
            </div>
            <div className="space-y-2">
              <Label>Datenschutzanforderung</Label>
              <SingleChips
                options={[
                  { key: "standard", label: "Standard" },
                  { key: "hoch", label: "Erhöht (sensible Daten)" },
                ]}
                selected={datenschutz}
                onSelect={setDatenschutz}
              />
            </div>
          </div>
        );

      case "recommendation":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Serverseitig berechneter Vorschlag auf Basis Ihrer Angaben. Sie
              können jeden Agenten ab- oder zuwählen.
            </p>
            {props.recommended.length === 0 ? (
              <Alert variant="warning">
                <InfoIcon />
                <AlertTitle>Noch keine Empfehlung</AlertTitle>
                <AlertDescription>
                  Bitte beantworten Sie zuerst die Fragen zu Zeitfressern und
                  Bereichen.
                </AlertDescription>
              </Alert>
            ) : (
              <ul className="space-y-2">
                {props.recommended.map((a) => {
                  const on = selected.includes(a.slug);
                  return (
                    <li key={a.slug}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(selected, setSelected, a.slug)}
                        className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                          on
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-foreground/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 font-medium">
                              {on ? (
                                <CheckCircle2Icon className="size-4 shrink-0 text-primary" />
                              ) : (
                                <CircleIcon className="size-4 shrink-0 text-muted-foreground" />
                              )}
                              {a.personaName}
                              <span className="text-sm font-normal text-muted-foreground">
                                — {a.roleTitle}
                              </span>
                            </p>
                            <p className="mt-1 pl-6 text-sm text-muted-foreground">
                              {a.reasons.join(" · ")}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <Badge variant="secondary">
                              {a.departmentName}
                            </Badge>
                            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                              {euro(a.monthlyCents)}/Monat
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-sm">
              Ausgewählt: <strong>{selected.length}</strong> Agent(en)
            </p>
          </div>
        );

      case "plan":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="wizard-yearly"
                checked={yearly}
                onCheckedChange={setYearly}
              />
              <Label htmlFor="wizard-yearly" className="cursor-pointer">
                Jährliche Zahlung (günstiger)
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {props.plans.map((p) => {
                const on = p.key === planKey;
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPlanKey(p.key)}
                    className={`cursor-pointer rounded-lg border p-4 text-left transition-colors ${
                      on
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30"
                    }`}
                  >
                    <p className="font-medium">{p.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                    <p className="mt-2 text-lg font-semibold tabular-nums">
                      {euro(
                        yearly
                          ? p.yearlyPricePerMonthCents
                          : p.monthlyPriceCents,
                      )}
                      <span className="text-sm font-normal text-muted-foreground">
                        {" "}
                        / Monat
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.includedAgentSeats} Agenten-Plätze ·{" "}
                      {p.includedRuns.toLocaleString("de-DE")} Läufe/Monat
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p>
                Voraussichtlich{" "}
                <strong className="tabular-nums">
                  {euro(props.monthlyTotalCents)}
                </strong>{" "}
                pro Monat (netto) inklusive der ausgewählten Agenten.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Die Berechnung erfolgt serverseitig und aktualisiert sich, sobald
                der Plan gespeichert ist. Die ersten 14 Tage sind eine Testphase
                ohne Zahlungsmittel.
              </p>
            </div>
            {props.canManageBilling ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    selectPlan(planKey, yearly ? "yearly" : "monthly").then(
                      (r) => ({ ok: r.ok, message: r.message }),
                    ),
                  )
                }
              >
                {pending ? <Spinner /> : null}
                Plan übernehmen
              </Button>
            ) : (
              <Alert variant="warning">
                <InfoIcon />
                <AlertTitle>Keine Abrechnungsberechtigung</AlertTitle>
                <AlertDescription>
                  Ihre Rolle darf den Plan nicht ändern. Bitten Sie die
                  Inhaberin oder den Inhaber der Organisation darum.
                </AlertDescription>
              </Alert>
            )}
          </div>
        );

      case "data-sources":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Agenten können nur auf verbundene Quellen zugreifen. Nicht
              verbundene Quellen bleiben gesperrt — es wird nichts simuliert.
            </p>
            <ul className="space-y-2">
              {props.connectors.map((c) => (
                <li
                  key={c.key}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                >
                  <span>{c.name}</span>
                  {c.connected ? (
                    <Badge variant="active">
                      <CheckCircle2Icon /> Verbunden
                    </Badge>
                  ) : c.status === "credentials_required" ? (
                    <Badge variant="warning">Zugangsdaten nötig</Badge>
                  ) : c.status === "planned" ? (
                    <Badge variant="paused">Nicht implementiert</Badge>
                  ) : (
                    <Badge variant="secondary">Verfügbar</Badge>
                  )}
                </li>
              ))}
            </ul>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/integrations">Integrationen verwalten</Link>
            </Button>
          </div>
        );

      case "knowledge":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mit einer gefüllten Wissensbasis antworten Agenten mit
              Quellenangabe statt aus dem Gedächtnis. Ohne passende Quelle
              sagen sie ausdrücklich, dass die Information fehlt.
            </p>
            <div className="rounded-lg border p-3 text-sm">
              Aktuell{" "}
              <strong className="tabular-nums">
                {props.knowledgeDocumentCount}
              </strong>{" "}
              Dokument(e) in der Wissensbasis.
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/knowledge">Dokumente hochladen</Link>
            </Button>
          </div>
        );

      case "team":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Rollen bestimmen, wer Agenten konfiguriert und wer Freigaben
              erteilen darf. Die Rolle „Viewer“ ist rein lesend, „Billing Admin“
              sieht keine operativen Unternehmensdaten.
            </p>
            <div className="rounded-lg border p-3 text-sm">
              Aktuell{" "}
              <strong className="tabular-nums">{props.teamMemberCount}</strong>{" "}
              Person(en) in der Organisation.
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/team">Team verwalten</Link>
            </Button>
          </div>
        );

      case "automation":
        return (
          <div className="space-y-4">
            <Label>Gewünschte Grundhaltung</Label>
            <SingleChips
              options={options.automatisierung}
              selected={automatisierung}
              onSelect={setAutomatisierung}
            />
            <Alert variant="info">
              <InfoIcon />
              <AlertTitle>So wirkt Ihre Wahl</AlertTitle>
              <AlertDescription>
                Sie setzt die Voreinstellung neuer Agenten. Jede Fähigkeit hat
                zusätzlich eine feste Sicherheitsobergrenze aus dem Katalog, die
                sich nicht überschreiben lässt — etwa beim Versand von
                E-Mails an Kunden. Feineinstellungen nehmen Sie später je Agent
                und Fähigkeit vor.
              </AlertDescription>
            </Alert>
          </div>
        );

      case "approvals":
        return (
          <div className="space-y-4">
            <Alert variant="info">
              <ShieldCheckIcon />
              <AlertTitle>Verbindliche Freigaberegeln</AlertTitle>
              <AlertDescription>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li>
                    Aktionen mit finanzieller, rechtlicher, personeller oder
                    reputationsbezogener Wirkung erfordern eine menschliche
                    Freigabe — unabhängig von der eingestellten
                    Automatisierungsstufe.
                  </li>
                  <li>
                    Sammelfreigaben sind ausschließlich für gleichartige,
                    risikoarme Aktionen möglich.
                  </li>
                  <li>
                    Freigaben führen genau die vorbereitete Aktion aus — auch
                    wenn Sie den Inhalt vorher bearbeiten. Es läuft kein neuer,
                    unkontrollierter Agentenlauf.
                  </li>
                  <li>
                    Entscheidungsberechtigt sind Owner, Admin, Manager und
                    Member; Viewer und Billing Admin nicht.
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/approvals">Approval Center ansehen</Link>
            </Button>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Offene Freigaben und Ergebnisse erscheinen in der Anwendung.
              E-Mail-Benachrichtigungen laufen ohne konfigurierten SMTP-Zugang
              in ein einsehbares Postausgangsfach — es wird nichts unbemerkt
              versendet.
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/settings">Benachrichtigungen einstellen</Link>
            </Button>
          </div>
        );

      case "sandbox-run":
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Jeder Agent absolviert einen Testlauf mit Beispieldaten und ohne
              Außenwirkung. Erst danach ist eine Aktivierung möglich.
            </p>
            {props.instances.length === 0 ? (
              <Alert variant="warning">
                <InfoIcon />
                <AlertTitle>Noch keine Agenten angelegt</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>
                    Legen Sie zuerst die ausgewählten Agenten an — sie starten
                    immer im Sandbox-Modus.
                  </p>
                  <Button
                    size="sm"
                    disabled={pending || selected.length === 0}
                    onClick={() => run(() => createSelectedAgents(selected))}
                  >
                    {pending ? <Spinner /> : null}
                    {selected.length} Agent(en) anlegen
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <ul className="space-y-2">
                  {props.instances.map((i) => (
                    <li
                      key={i.id}
                      className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
                    >
                      <span>{i.displayName}</span>
                      {i.sandboxPassed ? (
                        <Badge variant="active">
                          <CheckCircle2Icon /> Test bestanden
                        </Badge>
                      ) : (
                        <Badge variant="warning">Test ausstehend</Badge>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={pending || untestedCount === 0}
                    onClick={() =>
                      run(runSandboxForAll, (r) =>
                        setSandboxDetails(r.details ?? null),
                      )
                    }
                  >
                    {pending ? <Spinner /> : <FlaskConicalIcon />}
                    {untestedCount === 0
                      ? "Alle Tests bestanden"
                      : `${untestedCount} Testlauf/Testläufe starten`}
                  </Button>
                  {selected.length > props.instances.length ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => run(() => createSelectedAgents(selected))}
                    >
                      Fehlende Agenten anlegen
                    </Button>
                  ) : null}
                </div>
                {sandboxDetails ? (
                  <ul className="space-y-1.5 rounded-lg border p-3">
                    {sandboxDetails.map((d) => (
                      <li key={d.name} className="flex gap-2 text-sm">
                        {d.ok ? (
                          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-status-active" />
                        ) : (
                          <XCircleIcon className="mt-0.5 size-4 shrink-0 text-status-error" />
                        )}
                        <span>
                          <strong>{d.name}:</strong>{" "}
                          <span className="text-muted-foreground">
                            {d.message}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        );

      case "activate":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Agenten angelegt", value: props.instances.length },
                {
                  label: "Tests bestanden",
                  value: props.instances.filter((i) => i.sandboxPassed).length,
                },
                {
                  label: "Bereits aktiv",
                  value: props.instances.filter((i) => i.status === "active")
                    .length,
                },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
            {testedIds.length > 0 ? (
              <Button
                disabled={pending}
                onClick={() => run(() => activateTestedAgents(testedIds))}
              >
                {pending ? <Spinner /> : null}
                {testedIds.length} getestete(n) Agenten aktivieren
              </Button>
            ) : (
              <Alert variant={untestedCount > 0 ? "warning" : "success"}>
                <InfoIcon />
                <AlertTitle>
                  {untestedCount > 0
                    ? "Es fehlen noch Testläufe"
                    : "Alles bereit"}
                </AlertTitle>
                <AlertDescription>
                  {untestedCount > 0
                    ? "Gehen Sie zurück zu Schritt 13 und führen Sie die ausstehenden Sandbox-Testläufe aus."
                    : "Alle angelegten Agenten sind aktiviert oder warten bewusst in der Sandbox."}
                </AlertDescription>
              </Alert>
            )}
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(finishOnboarding, (r) => {
                  if (r.ok) router.push("/app");
                })
              }
            >
              {pending ? <Spinner /> : null}
              Einrichtung abschließen und zum Dashboard
            </Button>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Schritt {stepIndex} von {steps.length}
          </span>
          {step.optional ? (
            <Badge variant="outline">Optional</Badge>
          ) : null}
        </div>
        <Progress value={(stepIndex / steps.length) * 100} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{step.title}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepBody()}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          disabled={stepIndex === 1 || pending}
          onClick={() => setStepIndex((s) => Math.max(1, s - 1))}
        >
          <ArrowLeftIcon />
          Zurück
        </Button>
        <div className="flex items-center gap-2">
          {step.optional && !isLast ? (
            <Button variant="ghost" disabled={pending} onClick={goNext}>
              Überspringen
            </Button>
          ) : null}
          {!isLast ? (
            <Button disabled={pending} onClick={goNext}>
              {pending ? <Spinner /> : null}
              Weiter
              <ArrowRightIcon />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
