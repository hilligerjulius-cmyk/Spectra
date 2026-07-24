import Link from "next/link";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import {
  departmentList,
  getAgentsByDepartment,
} from "@/server/agents/catalog";
import { listAgentInstances } from "@/server/agents/instances";
import {
  formatEuro,
  getAgentMonthlyPriceCents,
} from "@/server/billing/pricing";
import { PageHeader } from "@/components/shared/page-header";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { HireDepartmentButton } from "@/components/agents/hire-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const ctx = await requireOrg();
  const hired = await listAgentInstances(ctx.organizationId);
  const hiredSlugs = new Set(hired.map((h) => h.instance.definitionSlug));
  const canHire = roleHasPermission(ctx.role, "agents", "activate");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Komplette digitale Abteilungen — einzeln buchbar oder als Paket mit Preisvorteil."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {departmentList.map((dept) => {
          const agents = getAgentsByDepartment(dept.slug);
          const hiredCount = agents.filter((a) => hiredSlugs.has(a.slug)).length;
          const individualSum = agents.reduce(
            (sum, a) => sum + getAgentMonthlyPriceCents(a),
            0,
          );
          return (
            <Card key={dept.slug} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{dept.name}</CardTitle>
                    <CardDescription>{dept.tagline}</CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {hiredCount}/{agents.length} im Team
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                  {dept.description}
                </p>
                {dept.disclaimer ? (
                  <p className="rounded-md border border-status-warning/40 bg-status-warning/8 p-2 text-xs">
                    {dept.disclaimer}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <Link
                      key={agent.slug}
                      href={`/app/marketplace/${agent.slug}`}
                      title={`${agent.personaName} — ${agent.roleTitle}`}
                      className="transition-transform hover:-translate-y-0.5"
                    >
                      <AgentAvatar
                        name={agent.personaName}
                        color={agent.avatarColor}
                        size="sm"
                        className={
                          hiredSlugs.has(agent.slug)
                            ? "ring-2 ring-status-active ring-offset-2 ring-offset-background"
                            : "opacity-70"
                        }
                      />
                    </Link>
                  ))}
                </div>
                <div className="mt-auto space-y-2 pt-2">
                  {dept.bundlePriceCents ? (
                    <p className="text-sm">
                      <span className="font-semibold">
                        {formatEuro(dept.bundlePriceCents)}/Monat
                      </span>{" "}
                      als Paket{" "}
                      <span className="text-muted-foreground">
                        (statt {formatEuro(individualSum)} einzeln)
                      </span>
                    </p>
                  ) : null}
                  {dept.slug !== "leadership" ? (
                    <HireDepartmentButton
                      department={dept.slug}
                      canHire={canHire}
                      remainingCount={agents.length - hiredCount}
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
