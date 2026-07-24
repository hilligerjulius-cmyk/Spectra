import { desc, inArray } from "drizzle-orm";
import { ActivityIcon } from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { withOrg } from "@/server/db/client";
import { agentInstance, agentRun, agentStep } from "@/server/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RunTimeline, type RunView } from "./run-timeline";

export const metadata = { title: "Activity" };

export default async function ActivityPage() {
  const ctx = await requireOrg();

  const runs = await withOrg(ctx.organizationId, (tx) =>
    tx.select().from(agentRun).orderBy(desc(agentRun.createdAt)).limit(30),
  );

  const runIds = runs.map((r) => r.id);
  const steps =
    runIds.length > 0
      ? await withOrg(ctx.organizationId, (tx) =>
          tx
            .select()
            .from(agentStep)
            .where(inArray(agentStep.runId, runIds))
            .orderBy(agentStep.index),
        )
      : [];

  const instanceIds = [...new Set(runs.map((r) => r.agentInstanceId))];
  const instances =
    instanceIds.length > 0
      ? await withOrg(ctx.organizationId, (tx) =>
          tx
            .select({
              id: agentInstance.id,
              displayName: agentInstance.displayName,
            })
            .from(agentInstance)
            .where(inArray(agentInstance.id, instanceIds)),
        )
      : [];
  const instanceMap = new Map(instances.map((i) => [i.id, i.displayName]));

  const data: RunView[] = runs.map((run) => ({
    id: run.id,
    agentName: instanceMap.get(run.agentInstanceId) ?? run.definitionSlug,
    goal: run.goal,
    capabilityKey: run.capabilityKey,
    status: run.status,
    summary: run.summary,
    sandbox: run.sandbox,
    trigger: String((run.trigger as { type?: string })?.type ?? "unbekannt"),
    costDeciCents: run.costDeciCents,
    durationMs: run.durationMs,
    model: run.model,
    createdAt: run.createdAt.toISOString(),
    steps: steps
      .filter((s) => s.runId === run.id)
      .map((s) => ({
        index: s.index,
        phase: s.phase,
        title: s.title,
        status: s.status,
        detail: s.detail,
        createdAt: s.createdAt.toISOString(),
      })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="Nachvollziehbare Timeline aller Agentenläufe: Planung, Tool-Aufrufe, Entwürfe, Freigaben, Ausführung und Ergebnisse."
      />
      {data.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon />}
          title="Noch keine Agentenläufe"
          description="Starten Sie einen Sandbox-Testlauf oder weisen Sie einem Agenten eine Aufgabe zu — jede Ausführung erscheint hier revisionsfähig."
        />
      ) : (
        <RunTimeline runs={data} />
      )}
    </div>
  );
}
