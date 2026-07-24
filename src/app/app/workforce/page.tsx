import Link from "next/link";
import { StoreIcon } from "lucide-react";
import { requireOrg } from "@/server/auth/guards";
import { listAgentInstances } from "@/server/agents/instances";
import { departments } from "@/server/agents/catalog";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkforceViews } from "./workforce-views";

export const metadata = { title: "My Workforce" };

export default async function WorkforcePage() {
  const ctx = await requireOrg();
  const items = await listAgentInstances(ctx.organizationId);

  const data = items.map(({ instance, definition }) => ({
    id: instance.id,
    displayName: instance.displayName,
    roleTitle: definition.roleTitle,
    departmentSlug: definition.department,
    departmentName: departments[definition.department].shortName,
    status: instance.status,
    avatarColor: definition.avatarColor,
    capabilityCount: definition.capabilities.length,
    priceTier: definition.priceTier,
    createdAt: instance.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Workforce"
        description={`${items.length} digitale ${items.length === 1 ? "Mitarbeiter" : "Mitarbeiter"} in Ihrem Team.`}
        actions={
          <Button asChild>
            <Link href="/app/marketplace">Agenten hinzufügen</Link>
          </Button>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<StoreIcon />}
          title="Ihr Team ist noch leer"
          description="Stellen Sie Ihre ersten digitalen Mitarbeiter im Marketplace ein. Jeder Agent startet im sicheren Sandbox-Modus."
          action={
            <Button asChild>
              <Link href="/app/marketplace">Zum Marketplace</Link>
            </Button>
          }
        />
      ) : (
        <WorkforceViews agents={data} />
      )}
    </div>
  );
}
