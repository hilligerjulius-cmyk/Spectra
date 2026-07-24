import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Zentrale Berechtigungsmatrix — Single Source of Truth für alle Rollen.
 * Serverseitige Durchsetzung über `requirePermission()` (src/server/auth/guards.ts)
 * und die Better-Auth-Organization-Zugriffskontrolle (Einladungen etc.).
 *
 * Rollen (Spec §7):
 * - owner:        Organisation, Abo, Nutzer, Integrationen, Agenten, Freigaberegeln
 * - admin:        wie Owner, aber ohne Abrechnung/Eigentumsübertragung/Org-Löschung
 * - manager:      überwacht Departments, entscheidet Freigaben, konfiguriert zugewiesene Agenten
 * - member:       nutzt Agenten, erteilt Freigaben sofern berechtigt
 * - viewer:       ausschließlich lesend
 * - billingAdmin: Abrechnung/Pläne, kein Zugriff auf operative Unternehmensdaten
 */

export const statement = {
  ...defaultStatements,
  agents: ["view", "configure", "activate", "run", "test"],
  approvals: ["view", "decide"],
  tasks: ["view", "manage"],
  goals: ["view", "manage"],
  knowledge: ["view", "upload", "manage"],
  integrations: ["view", "manage"],
  billing: ["view", "manage"],
  reports: ["view"],
  activity: ["view"],
  audit: ["view"],
  settings: ["view", "manage"],
  policies: ["view", "manage"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  owner: ac.newRole({
    ...ownerAc.statements,
    agents: ["view", "configure", "activate", "run", "test"],
    approvals: ["view", "decide"],
    tasks: ["view", "manage"],
    goals: ["view", "manage"],
    knowledge: ["view", "upload", "manage"],
    integrations: ["view", "manage"],
    billing: ["view", "manage"],
    reports: ["view"],
    activity: ["view"],
    audit: ["view"],
    settings: ["view", "manage"],
    policies: ["view", "manage"],
  }),
  admin: ac.newRole({
    ...adminAc.statements,
    agents: ["view", "configure", "activate", "run", "test"],
    approvals: ["view", "decide"],
    tasks: ["view", "manage"],
    goals: ["view", "manage"],
    knowledge: ["view", "upload", "manage"],
    integrations: ["view", "manage"],
    billing: ["view"],
    reports: ["view"],
    activity: ["view"],
    audit: ["view"],
    settings: ["view", "manage"],
    policies: ["view", "manage"],
  }),
  manager: ac.newRole({
    agents: ["view", "configure", "run", "test"],
    approvals: ["view", "decide"],
    tasks: ["view", "manage"],
    goals: ["view", "manage"],
    knowledge: ["view", "upload"],
    integrations: ["view"],
    reports: ["view"],
    activity: ["view"],
    settings: ["view"],
    policies: ["view"],
  }),
  member: ac.newRole({
    agents: ["view", "run"],
    approvals: ["view", "decide"],
    tasks: ["view", "manage"],
    goals: ["view"],
    knowledge: ["view", "upload"],
    integrations: ["view"],
    reports: ["view"],
    activity: ["view"],
    settings: ["view"],
  }),
  viewer: ac.newRole({
    agents: ["view"],
    approvals: ["view"],
    tasks: ["view"],
    goals: ["view"],
    knowledge: ["view"],
    integrations: ["view"],
    reports: ["view"],
    activity: ["view"],
    settings: ["view"],
  }),
  billingAdmin: ac.newRole({
    billing: ["view", "manage"],
    settings: ["view"],
  }),
} as const;

export type OrgRole = keyof typeof roles;

export type PermissionResource = keyof typeof statement;
export type PermissionAction<R extends PermissionResource> =
  (typeof statement)[R][number];

/** Prüft rein in-memory, ob eine Rolle eine Berechtigung besitzt. */
export function roleHasPermission<R extends PermissionResource>(
  role: string,
  resource: R,
  action: PermissionAction<R>,
): boolean {
  const def = roles[role as OrgRole];
  if (!def) return false;
  const allowed = (
    def.statements as Partial<Record<PermissionResource, readonly string[]>>
  )[resource];
  return Boolean(allowed?.includes(action));
}

export const ALL_ROLES: OrgRole[] = [
  "owner",
  "admin",
  "manager",
  "member",
  "viewer",
  "billingAdmin",
];
