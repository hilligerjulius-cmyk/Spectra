import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import { getAgentInstance, effectiveAutomationLevel } from "@/server/agents/instances";
import { departments } from "@/server/agents/catalog";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationSettings } from "./automation-settings";
import { AgentSettings } from "./agent-settings";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrg();
  const item = await getAgentInstance(ctx.organizationId, id);
  if (!item) notFound();
  const { instance, definition } = item;
  const canConfigure = roleHasPermission(ctx.role, "agents", "configure");
  const canActivate = roleHasPermission(ctx.role, "agents", "activate");

  const capabilities = definition.capabilities.map((cap) => ({
    key: cap.key,
    name: cap.name,
    description: cap.description,
    riskLevel: cap.riskLevel,
    maxLevel: cap.maxAutomationLevel,
    currentLevel: effectiveAutomationLevel(item, cap.key),
    requiredTools: cap.requiredTools,
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/app/workforce"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Zurück zu My Workforce
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <AgentAvatar
            name={instance.displayName}
            color={definition.avatarColor}
            size="lg"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {instance.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {definition.roleTitle} ·{" "}
              {departments[definition.department].shortName}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge status={instance.status} />
              {instance.status === "sandbox" ? (
                <Badge variant="warning">Testlauf ausstehend</Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {instance.status === "sandbox" ? (
        <Alert variant="info">
          <InfoIcon />
          <AlertTitle>Sandbox-Modus</AlertTitle>
          <AlertDescription>
            Dieser Agent arbeitet noch nicht mit echten Systemen. Führen Sie
            einen Testlauf aus und aktivieren Sie ihn anschließend. Der Testlauf
            wird mit der Agent-Runtime (Phase 5/6) verfügbar.
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="tools">Tools & Permissions</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stellenbeschreibung</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {definition.description}
              </p>
              <div>
                <p className="mb-1 text-sm font-medium">Aufgaben</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {definition.responsibilities.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Grenzen</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {definition.boundaries.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">KPIs</CardTitle>
              <CardDescription>
                Kennzahlen werden erfasst, sobald der Agent Läufe ausführt
                (Runtime folgt in Phase 5/6). Es werden keine erfundenen Werte
                angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {definition.kpis.map((kpi) => (
                  <li key={kpi.key} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{kpi.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Noch keine Daten · {kpi.unit}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automations">
          <AutomationSettings
            instanceId={instance.id}
            capabilities={capabilities}
            canConfigure={canConfigure}
          />
        </TabsContent>

        <TabsContent value="tools">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Freigegebene Tools</CardTitle>
              <CardDescription>
                Dieser Agent kann ausschließlich die folgenden Tools verwenden.
                Die Durchsetzung erfolgt serverseitig in der Agent-Runtime.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {instance.allowedTools.map((tool) => (
                  <Badge key={tool} variant="secondary" className="font-mono">
                    {tool}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <AgentSettings
            instanceId={instance.id}
            displayName={instance.displayName}
            status={instance.status}
            sandboxPassed={Boolean(instance.sandboxPassedAt)}
            canConfigure={canConfigure}
            canActivate={canActivate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
