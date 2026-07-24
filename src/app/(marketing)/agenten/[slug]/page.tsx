import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ShieldAlertIcon,
  XCircleIcon,
} from "lucide-react";
import {
  agentCatalog,
  AUTOMATION_LEVELS,
  departments,
  getAgentDefinition,
} from "@/server/agents/catalog";
import {
  formatEuro,
  getAgentMonthlyPriceCents,
} from "@/server/billing/pricing";
import { AgentAvatar } from "@/components/agents/agent-avatar";
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

export function generateStaticParams() {
  return agentCatalog.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = getAgentDefinition(slug);
  if (!agent) return {};
  return {
    title: `${agent.personaName} — ${agent.roleTitle}`,
    description: agent.tagline,
  };
}

export default async function AgentMarketingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgentDefinition(slug);
  if (!agent) notFound();
  const dept = departments[agent.department];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16">
      <Link
        href="/agenten"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Alle Agenten
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <AgentAvatar
            name={agent.personaName}
            color={agent.avatarColor}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {agent.personaName}
            </h1>
            <p className="text-lg text-muted-foreground">{agent.roleTitle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{dept.name}</Badge>
              <Badge variant="outline">
                {formatEuro(getAgentMonthlyPriceCents(agent))}/Monat
              </Badge>
            </div>
          </div>
        </div>
        <Button size="lg" asChild>
          <Link href="/register">
            {agent.personaName} einstellen
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>

      <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
        {agent.description}
      </p>

      {dept.disclaimer ? (
        <Alert variant="warning" className="mt-6">
          <ShieldAlertIcon />
          <AlertTitle>Wichtiger Hinweis</AlertTitle>
          <AlertDescription>{dept.disclaimer}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Das übernimmt {agent.personaName}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {agent.responsibilities.map((r) => (
                <li key={r} className="flex gap-2 text-sm">
                  <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-status-active" />
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Klare Grenzen</CardTitle>
            <CardDescription>Was dieser Agent bewusst nicht tut.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {agent.boundaries.map((b) => (
                <li key={b} className="flex gap-2 text-sm">
                  <XCircleIcon className="mt-0.5 size-4 shrink-0 text-status-error" />
                  {b}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">So arbeitet {agent.personaName}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {agent.workflow.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fähigkeiten & Kontrolle</CardTitle>
            <CardDescription>
              Automatisierungsstufe je Fähigkeit einstellbar — mit
              Sicherheitsobergrenze.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {agent.capabilities.map((cap) => (
              <div key={cap.key} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{cap.name}</p>
                <p className="text-muted-foreground">{cap.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Standard: {AUTOMATION_LEVELS[cap.defaultAutomationLevel].name}{" "}
                  · Max: Stufe {cap.maxAutomationLevel}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voraussetzungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="font-medium">Integrationen: </span>
              <span className="text-muted-foreground">
                {agent.requiredIntegrations.length > 0
                  ? agent.requiredIntegrations.join(", ")
                  : "keine erforderlich"}
              </span>
            </p>
            <p>
              <span className="font-medium">Benötigte Daten: </span>
              <span className="text-muted-foreground">
                {agent.dataRequirements.join("; ") || "keine besonderen"}
              </span>
            </p>
            <p>
              <span className="font-medium">Einrichtung: </span>
              <span className="text-muted-foreground">
                {agent.setupEffort === "low"
                  ? "gering (unter 1 Stunde)"
                  : agent.setupEffort === "medium"
                    ? "mittel (1–3 Stunden)"
                    : "hoch (individuelle Konfiguration)"}
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messbare KPIs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {agent.kpis.map((kpi) => (
                <li key={kpi.key} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{kpi.label}</p>
                  <p className="text-xs text-muted-foreground">{kpi.unit}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Häufige Fragen</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          {agent.faq.map((f) => (
            <div key={f.q}>
              <p className="text-sm font-medium">{f.q}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-12 flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-10 text-center">
        <h2 className="text-xl font-semibold">
          {agent.personaName} in Ihr Team holen?
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Starten Sie kostenlos, testen Sie {agent.personaName} in der Sandbox
          und aktivieren Sie den Agenten erst, wenn Sie überzeugt sind.
        </p>
        <div className="mt-3 flex gap-3">
          <Button asChild>
            <Link href="/register">Kostenlos starten</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/konfigurator">Team-Konfigurator</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
