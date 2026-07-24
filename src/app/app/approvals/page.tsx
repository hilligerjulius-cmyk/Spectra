import { desc, eq, inArray } from "drizzle-orm";
import { ShieldCheckIcon } from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import { withOrg } from "@/server/db/client";
import { agentInstance, approvalRequest } from "@/server/db/schema";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ApprovalList, type ApprovalItem } from "./approval-list";

export const metadata = { title: "Approvals" };

export default async function ApprovalsPage() {
  const ctx = await requireOrg();
  const canDecide = roleHasPermission(ctx.role, "approvals", "decide");

  const { pending, decided } = await withOrg(ctx.organizationId, async (tx) => {
    const pending = await tx
      .select()
      .from(approvalRequest)
      .where(eq(approvalRequest.status, "pending"))
      .orderBy(desc(approvalRequest.createdAt))
      .limit(50);
    const decided = await tx
      .select()
      .from(approvalRequest)
      .where(
        inArray(approvalRequest.status, [
          "approved",
          "rejected",
          "expired",
          "cancelled",
        ]),
      )
      .orderBy(desc(approvalRequest.decidedAt))
      .limit(20);
    return { pending, decided };
  });

  const instanceIds = [
    ...new Set([...pending, ...decided].map((a) => a.agentInstanceId)),
  ];
  const instances =
    instanceIds.length > 0
      ? await withOrg(ctx.organizationId, (tx) =>
          tx
            .select({
              id: agentInstance.id,
              displayName: agentInstance.displayName,
              definitionSlug: agentInstance.definitionSlug,
            })
            .from(agentInstance)
            .where(inArray(agentInstance.id, instanceIds)),
        )
      : [];
  const instanceMap = new Map(instances.map((i) => [i.id, i]));

  function toItem(a: (typeof pending)[number]): ApprovalItem {
    const inst = instanceMap.get(a.agentInstanceId);
    return {
      id: a.id,
      agentName: inst?.displayName ?? "Unbekannter Agent",
      title: a.title,
      reasoning: a.reasoning,
      actionType: a.actionType,
      riskLevel: a.riskLevel as ApprovalItem["riskLevel"],
      payload: a.payload,
      affectedData: a.affectedData,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      decidedAt: a.decidedAt?.toISOString() ?? null,
      decisionNote: a.decisionNote,
      estimatedCostDeciCents: a.estimatedCostDeciCents,
      runId: a.runId,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Jede geplante Aktion mit Begründung, betroffenen Daten und Risikostufe — Sie entscheiden."
      />
      {pending.length === 0 ? (
        <EmptyState
          icon={<ShieldCheckIcon />}
          title="Keine offenen Freigaben"
          description="Sobald ein Agent eine Aktion vorbereitet, die menschliche Freigabe benötigt, erscheint sie hier."
        />
      ) : (
        <ApprovalList
          items={pending.map(toItem)}
          canDecide={canDecide}
          mode="pending"
        />
      )}

      {decided.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Zuletzt entschieden
          </h2>
          <ApprovalList
            items={decided.map(toItem)}
            canDecide={false}
            mode="history"
          />
        </div>
      ) : null}
    </div>
  );
}
