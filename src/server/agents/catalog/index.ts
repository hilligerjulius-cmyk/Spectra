import type { AgentDefinitionData, DepartmentSlug } from "./types";
import { leadershipAgents } from "./leadership";
import { salesAgents } from "./sales";
import { officeAgents } from "./office";
import { financeAgents } from "./finance";
import { hrAgents } from "./hr";
import { customerServiceAgents } from "./customer-service";
import { operationsAgents } from "./operations";
import { knowledgeAgents } from "./knowledge";

export * from "./types";
export * from "./departments";

/** Vollständiger Agentenkatalog (57 Agenten: 7 Fach-Departments × 8 + Chief of Staff). */
export const agentCatalog: AgentDefinitionData[] = [
  ...leadershipAgents,
  ...salesAgents,
  ...officeAgents,
  ...financeAgents,
  ...hrAgents,
  ...customerServiceAgents,
  ...operationsAgents,
  ...knowledgeAgents,
];

const bySlug = new Map(agentCatalog.map((a) => [a.slug, a]));

export function getAgentDefinition(
  slug: string,
): AgentDefinitionData | undefined {
  return bySlug.get(slug);
}

export function getAgentsByDepartment(
  department: DepartmentSlug,
): AgentDefinitionData[] {
  return agentCatalog.filter((a) => a.department === department);
}
