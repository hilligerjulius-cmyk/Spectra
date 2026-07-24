import { requireOrg } from "@/server/auth/guards";
import { roleHasPermission } from "@/server/auth/permissions";
import { withOrg } from "@/server/db/client";
import { calendarEvent, emailMessage, integration } from "@/server/db/schema";
import {
  connectorRegistry,
  isConnectorAvailable,
} from "@/server/integrations/registry";
import { hasDemoData } from "@/server/demo/seed";
import { PageHeader } from "@/components/shared/page-header";
import { IntegrationsView, type ConnectorView } from "./integrations-view";

export const metadata = { title: "Integrations" };

export default async function IntegrationsPage() {
  const ctx = await requireOrg();
  const canManage = roleHasPermission(ctx.role, "integrations", "manage");

  const connected = await withOrg(ctx.organizationId, (tx) =>
    tx.select().from(integration),
  );
  const connectedMap = new Map(connected.map((c) => [c.connectorKey, c]));

  const connectors: ConnectorView[] = connectorRegistry.map((def) => ({
    key: def.key,
    name: def.name,
    category: def.category,
    description: def.description,
    status: def.status,
    available: isConnectorAvailable(def),
    requiredEnv: def.requiredEnv ?? [],
    setupNote: def.setupNote ?? null,
    connectionStatus: connectedMap.get(def.key)?.status ?? null,
  }));

  const demoActive = await hasDemoData(ctx.organizationId);

  // Live-Daten der Demo-Connectoren (echte Zahlen, keine Platzhalter)
  const { inboxCount, untriagedCount, outboxCount, eventCount, recentEmails } =
    await withOrg(ctx.organizationId, async (tx) => {
      const inbox = await tx.select().from(emailMessage).limit(200);
      const events = await tx.select().from(calendarEvent).limit(100);
      return {
        inboxCount: inbox.filter((m) => m.direction === "inbound").length,
        untriagedCount: inbox.filter(
          (m) => m.direction === "inbound" && m.triagedAt === null,
        ).length,
        outboxCount: inbox.filter((m) => m.direction === "outbound").length,
        eventCount: events.length,
        recentEmails: inbox
          .sort(
            (a, b) =>
              (b.receivedAt ?? b.createdAt).getTime() -
              (a.receivedAt ?? a.createdAt).getTime(),
          )
          .slice(0, 8)
          .map((m) => ({
            id: m.id,
            direction: m.direction,
            status: m.status,
            from: m.fromAddress,
            to: m.toAddress,
            subject: m.subject,
            category: m.category,
            urgency: m.urgency,
            suspicious: m.suspicious,
            triaged: m.triagedAt !== null,
            demo: m.demo,
          })),
      };
    });


  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Verbundene Systeme und verfügbare Connectoren. Nicht implementierte Anbindungen sind ausdrücklich als solche gekennzeichnet."
      />
      <IntegrationsView
        connectors={connectors}
        canManage={canManage}
        demoActive={demoActive}
        stats={{ inboxCount, untriagedCount, outboxCount, eventCount }}
        recentEmails={recentEmails}
      />
    </div>
  );
}
