import type { Metadata } from "next";
import Link from "next/link";
import {
  departmentList,
  getAgentsByDepartment,
} from "@/server/agents/catalog";
import {
  formatEuro,
  getAgentMonthlyPriceCents,
} from "@/server/billing/pricing";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Alle Agenten",
  description:
    "57 spezialisierte digitale Mitarbeiter in 8 Departments — jeder mit klaren Aufgaben, Grenzen, Berechtigungen und KPIs.",
};

export default function AgentenPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="mb-12 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Alle digitalen Mitarbeiter
        </h1>
        <p className="mt-3 text-muted-foreground">
          Jeder Agent hat eine klare Stellenbeschreibung, definierte Grenzen,
          eigene KPIs und startet im sicheren Sandbox-Modus.
        </p>
      </div>

      <div className="space-y-14">
        {departmentList.map((dept) => {
          const agents = getAgentsByDepartment(dept.slug);
          return (
            <section key={dept.slug} aria-labelledby={`dept-${dept.slug}`}>
              <div className="mb-5">
                <h2
                  id={`dept-${dept.slug}`}
                  className="text-xl font-semibold tracking-tight"
                >
                  {dept.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dept.tagline}
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {agents.map((agent) => (
                  <Link key={agent.slug} href={`/agenten/${agent.slug}`}>
                    <Card className="h-full transition-shadow hover:shadow-md">
                      <CardHeader>
                        <div className="flex items-center gap-3">
                          <AgentAvatar
                            name={agent.personaName}
                            color={agent.avatarColor}
                          />
                          <div className="min-w-0">
                            <CardTitle className="truncate text-sm">
                              {agent.personaName}
                            </CardTitle>
                            <CardDescription className="truncate text-xs">
                              {agent.roleTitle}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {agent.tagline}
                        </p>
                        <Badge variant="outline" className="mt-3">
                          ab {formatEuro(getAgentMonthlyPriceCents(agent))}/Monat
                        </Badge>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
