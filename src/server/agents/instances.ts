import "server-only";
import { asc, eq } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import { agentInstance } from "@/server/db/schema";
import {
  getAgentDefinition,
  type AgentDefinitionData,
  type AutomationLevel,
} from "@/server/agents/catalog";

export type AgentInstanceRow = typeof agentInstance.$inferSelect;

export interface AgentInstanceWithDef {
  instance: AgentInstanceRow;
  definition: AgentDefinitionData;
}

/** Alle Agenten-Instanzen der Organisation inkl. Katalogdefinition. */
export async function listAgentInstances(
  organizationId: string,
): Promise<AgentInstanceWithDef[]> {
  const rows = await withOrg(organizationId, (tx) =>
    tx.select().from(agentInstance).orderBy(asc(agentInstance.createdAt)),
  );
  return rows.flatMap((instance) => {
    const definition = getAgentDefinition(instance.definitionSlug);
    // Instanzen ohne Katalogdefinition (z. B. entfernter Agent) werden ausgefiltert,
    // aber nicht gelöscht — sie bleiben im Audit nachvollziehbar.
    return definition ? [{ instance, definition }] : [];
  });
}

export async function getAgentInstance(
  organizationId: string,
  instanceId: string,
): Promise<AgentInstanceWithDef | null> {
  const rows = await withOrg(organizationId, (tx) =>
    tx.select().from(agentInstance).where(eq(agentInstance.id, instanceId)),
  );
  const instance = rows[0];
  if (!instance) return null;
  const definition = getAgentDefinition(instance.definitionSlug);
  return definition ? { instance, definition } : null;
}

/**
 * Effektive Automatisierungsstufe einer Fähigkeit: Override der Organisation,
 * gedeckelt durch die Katalog-Obergrenze; deaktivierte Fähigkeiten = 0.
 */
export function effectiveAutomationLevel(
  item: AgentInstanceWithDef,
  capabilityKey: string,
): AutomationLevel {
  const cap = item.definition.capabilities.find((c) => c.key === capabilityKey);
  if (!cap) return 0;
  if (item.instance.disabledCapabilities.includes(capabilityKey)) return 0;
  const override = item.instance.automationOverrides[capabilityKey];
  const level = override ?? cap.defaultAutomationLevel;
  return Math.min(level, cap.maxAutomationLevel) as AutomationLevel;
}
