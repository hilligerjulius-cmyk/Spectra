import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Departments",
  description:
    "Sieben digitale Abteilungen plus Chief of Staff — einzeln buchbar oder als Paket mit Preisvorteil.",
};

export default function DepartmentsMarketingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="mb-12 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Digitale Departments
        </h1>
        <p className="mt-3 text-muted-foreground">
          Buchen Sie einzelne Agenten oder komplette Abteilungen. Jedes
          Department bündelt acht spezialisierte Rollen zu einem Paketpreis.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {departmentList.map((dept) => {
          const agents = getAgentsByDepartment(dept.slug);
          const individualSum = agents.reduce(
            (sum, a) => sum + getAgentMonthlyPriceCents(a),
            0,
          );
          return (
            <Card key={dept.slug} className="flex flex-col">
              <CardHeader>
                <CardTitle>{dept.name}</CardTitle>
                <CardDescription>{dept.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                {dept.disclaimer ? (
                  <p className="rounded-md border border-status-warning/40 bg-status-warning/8 p-2 text-xs">
                    {dept.disclaimer}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {agents.map((agent) => (
                    <Link
                      key={agent.slug}
                      href={`/agenten/${agent.slug}`}
                      className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition-colors hover:bg-muted"
                    >
                      <AgentAvatar
                        name={agent.personaName}
                        color={agent.avatarColor}
                        size="sm"
                        className="size-6 text-[10px]"
                      />
                      {agent.personaName}
                    </Link>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  {dept.bundlePriceCents ? (
                    <div>
                      <p className="text-lg font-semibold">
                        {formatEuro(dept.bundlePriceCents)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /Monat als Paket
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        statt {formatEuro(individualSum)} einzeln
                      </p>
                    </div>
                  ) : (
                    <Badge variant="secondary">Einzelagent</Badge>
                  )}
                  <Button variant="outline" asChild>
                    <Link href="/konfigurator">
                      Konfigurieren <ArrowRightIcon />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
