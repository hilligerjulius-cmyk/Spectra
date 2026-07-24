import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ShieldAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import {
  AUTOMATION_LEVELS,
  departments,
  getAgentDefinition,
} from "@/server/agents/catalog";
import { listAgentInstances } from "@/server/agents/instances";
import {
  formatEuro,
  getAgentMonthlyPriceCents,
} from "@/server/billing/pricing";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { HireAgentButton } from "@/components/agents/hire-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function MarketplaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getAgentDefinition(slug);
  if (!agent) notFound();

  const ctx = await requireOrg();
  const hired = await listAgentInstances(ctx.organizationId);
  const instance = hired.find((h) => h.instance.definitionSlug === slug);
  const canHire = roleHasPermission(ctx.role, "agents", "activate");
  const dept = departments[agent.department];

  return (
    <div className="space-y-6">
      <Link
        href="/app/marketplace"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Zurück zum Marketplace
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <AgentAvatar name={agent.personaName} color={agent.avatarColor} size="lg" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {agent.personaName}{" "}
              <span className="text-muted-foreground">— {agent.roleTitle}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{agent.tagline}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="secondary">{dept.name}</Badge>
              <Badge variant="outline">
                {formatEuro(getAgentMonthlyPriceCents(agent))}/Monat
              </Badge>
              {agent.securityLevel === "elevated" ? (
                <Badge variant="approval">Erhöhte Sicherheitsstufe</Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {instance ? (
            <Button asChild variant="secondary">
              <Link href={`/app/agents/${instance.instance.id}`}>
                Zur Konfiguration
              </Link>
            </Button>
          ) : null}
          <HireAgentButton
            slug={agent.slug}
            alreadyHired={Boolean(instance)}
            canHire={canHire}
          />
        </div>
      </div>

      {dept.disclaimer ? (
        <Alert variant="warning">
          <ShieldAlertIcon />
          <AlertTitle>Wichtiger Hinweis</AlertTitle>
          <AlertDescription>{dept.disclaimer}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stellenbeschreibung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{agent.description}</p>
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
            <CardDescription>
              Was dieser Agent bewusst nicht tut.
            </CardDescription>
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
            <CardTitle className="text-base">Fähigkeiten & Automatisierung</CardTitle>
            <CardDescription>
              Jede Fähigkeit ist einzeln konfigurierbar — mit Sicherheitsobergrenze.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {agent.capabilities.map((cap) => (
              <div key={cap.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{cap.name}</p>
                  <Badge
                    variant={
                      cap.riskLevel === "high"
                        ? "error"
                        : cap.riskLevel === "medium"
                          ? "warning"
                          : "active"
                    }
                  >
                    Risiko: {cap.riskLevel === "high" ? "hoch" : cap.riskLevel === "medium" ? "mittel" : "gering"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cap.description}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Standard: Stufe {cap.defaultAutomationLevel} (
                  {AUTOMATION_LEVELS[cap.defaultAutomationLevel].name}) · Maximum:
                  Stufe {cap.maxAutomationLevel}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Arbeitsablauf</CardTitle>
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
              <CardTitle className="text-base">Voraussetzungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Benötigte Integrationen</p>
                <p className="text-muted-foreground">
                  {agent.requiredIntegrations.length > 0
                    ? agent.requiredIntegrations.join(", ")
                    : "Keine — arbeitet mit Plattformdaten"}
                </p>
              </div>
              {agent.optionalIntegrations.length > 0 ? (
                <div>
                  <p className="font-medium">Optionale Integrationen</p>
                  <p className="text-muted-foreground">
                    {agent.optionalIntegrations.join(", ")}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="font-medium">Benötigte Daten</p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {agent.dataRequirements.length > 0 ? (
                    agent.dataRequirements.map((d) => <li key={d}>{d}</li>)
                  ) : (
                    <li>Keine besonderen Anforderungen</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">KPIs</CardTitle>
            <CardDescription>
              Woran Sie die Leistung dieses Agenten messen.
            </CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Häufige Fragen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {agent.faq.map((f) => (
              <div key={f.q}>
                <p className="text-sm font-medium">{f.q}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
