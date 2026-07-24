import Link from "next/link";
import { Suspense } from "react";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import {
  agentCatalog,
  departments,
  type PriceTier,
  type SetupEffort,
} from "@/server/agents/catalog";
import { listAgentInstances } from "@/server/agents/instances";
import {
  getAgentMonthlyPriceCents,
  formatEuro,
} from "@/server/billing/pricing";
import { PageHeader } from "@/components/shared/page-header";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { HireAgentButton } from "@/components/agents/hire-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarketplaceFilters } from "./marketplace-filters";

export const metadata = { title: "Marketplace" };

const effortLabel: Record<SetupEffort, string> = {
  low: "Einrichtung: gering",
  medium: "Einrichtung: mittel",
  high: "Einrichtung: hoch",
};

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{
    department?: string;
    preis?: string;
    aufwand?: string;
  }>;
}) {
  const ctx = await requireOrg();
  const params = await searchParams;
  const hired = await listAgentInstances(ctx.organizationId);
  const hiredSlugs = new Set(hired.map((h) => h.instance.definitionSlug));
  const canHire = roleHasPermission(ctx.role, "agents", "activate");

  let agents = agentCatalog;
  if (params.department) {
    agents = agents.filter((a) => a.department === params.department);
  }
  if (params.preis) {
    agents = agents.filter((a) => a.priceTier === (params.preis as PriceTier));
  }
  if (params.aufwand) {
    agents = agents.filter(
      (a) => a.setupEffort === (params.aufwand as SetupEffort),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace"
        description={`${agentCatalog.length} spezialisierte digitale Mitarbeiter in ${Object.keys(departments).length} Departments. Jeder Agent startet im sicheren Sandbox-Modus.`}
      />

      <Suspense>
        <MarketplaceFilters />
      </Suspense>

      <p className="text-sm text-muted-foreground">
        {agents.length} {agents.length === 1 ? "Agent" : "Agenten"} gefunden
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.slug} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AgentAvatar
                    name={agent.personaName}
                    color={agent.avatarColor}
                  />
                  <div>
                    <CardTitle className="text-base">
                      {agent.personaName}
                    </CardTitle>
                    <CardDescription>{agent.roleTitle}</CardDescription>
                  </div>
                </div>
                {hiredSlugs.has(agent.slug) ? (
                  <Badge variant="active">Im Team</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <p className="text-sm text-muted-foreground">{agent.tagline}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">
                  {departments[agent.department].shortName}
                </Badge>
                <Badge variant="outline">
                  {formatEuro(getAgentMonthlyPriceCents(agent))}/Monat
                </Badge>
                <Badge variant="outline">{effortLabel[agent.setupEffort]}</Badge>
                {agent.securityLevel === "elevated" ? (
                  <Badge variant="approval">Erhöhte Sicherheitsstufe</Badge>
                ) : null}
              </div>
              {agent.requiredIntegrations.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Benötigt: {agent.requiredIntegrations.join(", ")}
                </p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <Link
                  href={`/app/marketplace/${agent.slug}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Details ansehen
                </Link>
                <HireAgentButton
                  slug={agent.slug}
                  alreadyHired={hiredSlugs.has(agent.slug)}
                  canHire={canHire}
                  size="sm"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
