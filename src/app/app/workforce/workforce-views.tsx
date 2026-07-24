"use client";

import Link from "next/link";
import { LayoutGridIcon, ListIcon, NetworkIcon } from "lucide-react";
import { AgentAvatar } from "@/components/agents/agent-avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface WorkforceAgent {
  id: string;
  displayName: string;
  roleTitle: string;
  departmentSlug: string;
  departmentName: string;
  status: string;
  avatarColor: string;
  capabilityCount: number;
  priceTier: string;
  createdAt: string;
}

export function WorkforceViews({ agents }: { agents: WorkforceAgent[] }) {
  const byDepartment = new Map<string, WorkforceAgent[]>();
  for (const agent of agents) {
    const list = byDepartment.get(agent.departmentName) ?? [];
    list.push(agent);
    byDepartment.set(agent.departmentName, list);
  }

  return (
    <Tabs defaultValue="cards">
      <TabsList>
        <TabsTrigger value="cards">
          <LayoutGridIcon /> Karten
        </TabsTrigger>
        <TabsTrigger value="list">
          <ListIcon /> Liste
        </TabsTrigger>
        <TabsTrigger value="orgchart">
          <NetworkIcon /> Organigramm
        </TabsTrigger>
      </TabsList>

      <TabsContent value="cards">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/app/agents/${agent.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <AgentAvatar
                    name={agent.displayName}
                    color={agent.avatarColor}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{agent.displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {agent.roleTitle}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge status={agent.status} />
                      <Badge variant="secondary">{agent.departmentName}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="list">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Fähigkeiten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell>
                    <Link
                      href={`/app/agents/${agent.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <AgentAvatar
                        name={agent.displayName}
                        color={agent.avatarColor}
                        size="sm"
                      />
                      {agent.displayName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {agent.roleTitle}
                  </TableCell>
                  <TableCell>{agent.departmentName}</TableCell>
                  <TableCell>
                    <StatusBadge status={agent.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {agent.capabilityCount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="orgchart">
        <div className="space-y-6">
          {[...byDepartment.entries()].map(([dept, deptAgents]) => (
            <div key={dept}>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{dept}</h3>
                <Badge variant="secondary">{deptAgents.length}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 border-l-2 border-border pl-4">
                {deptAgents.map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/app/agents/${agent.id}`}
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm transition-shadow hover:shadow-sm"
                  >
                    <AgentAvatar
                      name={agent.displayName}
                      color={agent.avatarColor}
                      size="sm"
                    />
                    <span>
                      <span className="block font-medium">
                        {agent.displayName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {agent.roleTitle}
                      </span>
                    </span>
                    <StatusBadge status={agent.status} className="ml-1" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
