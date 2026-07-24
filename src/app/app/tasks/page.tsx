import { desc, inArray } from "drizzle-orm";
import { SquareCheckIcon } from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import { withOrg } from "@/server/db/client";
import { agentInstance, task } from "@/server/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TaskList, type TaskView } from "./task-list";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const ctx = await requireOrg();
  const canManage = roleHasPermission(ctx.role, "tasks", "manage");

  const rows = await withOrg(ctx.organizationId, (tx) =>
    tx.select().from(task).orderBy(desc(task.createdAt)).limit(100),
  );

  const instanceIds = [
    ...new Set(rows.map((t) => t.agentInstanceId).filter(Boolean) as string[]),
  ];
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

  const data: TaskView[] = rows.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt?.toISOString() ?? null,
    agentName: t.agentInstanceId
      ? (instanceMap.get(t.agentInstanceId) ?? null)
      : null,
    createdByType: t.createdByType,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Aufgaben aus E-Mails, Meetings und Agentenläufen — mit Herkunft und Verantwortlichkeit."
      />
      {data.length === 0 ? (
        <EmptyState
          icon={<SquareCheckIcon />}
          title="Noch keine Aufgaben"
          description="Aufgaben entstehen, sobald Agenten (z. B. der Task Agent) sie aus E-Mails oder Protokollen extrahieren — nach Ihren Freigaberegeln."
        />
      ) : (
        <TaskList tasks={data} canManage={canManage} />
      )}
    </div>
  );
}
