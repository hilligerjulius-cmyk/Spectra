import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth, type Session } from "./auth";
import {
  roleHasPermission,
  type PermissionAction,
  type PermissionResource,
} from "./permissions";
import { adminDb } from "@/server/db/client";
import { member } from "@/server/db/schema";

export class PermissionError extends Error {
  readonly status = 403;
  constructor(message = "Keine Berechtigung für diese Aktion.") {
    super(message);
    this.name = "PermissionError";
  }
}

export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

/** Erfordert eine aktive Session, sonst Redirect auf /login. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export interface OrgContext {
  session: Session;
  userId: string;
  organizationId: string;
  role: string;
}

/**
 * Erfordert Session + aktive Organisation + Mitgliedschaft.
 * Die Mitgliedschaft wird immer serverseitig in der DB verifiziert —
 * niemals nur aus dem Client-State übernommen (IDOR-Schutz).
 */
export async function requireOrg(): Promise<OrgContext> {
  const session = await requireSession();
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) redirect("/onboarding");
  const membership = await adminDb.query.member.findFirst({
    where: and(
      eq(member.organizationId, organizationId),
      eq(member.userId, session.user.id),
    ),
  });
  if (!membership) redirect("/onboarding");
  return {
    session,
    userId: session.user.id,
    organizationId,
    role: membership.role,
  };
}

/**
 * Serverseitige Berechtigungsprüfung für Seiten/Server Actions.
 * Wirft PermissionError, wenn die Rolle die Aktion nicht erlaubt.
 */
export async function requirePermission<R extends PermissionResource>(
  resource: R,
  action: PermissionAction<R>,
): Promise<OrgContext> {
  const ctx = await requireOrg();
  assertPermission(ctx, resource, action);
  return ctx;
}

/** In-Memory-Prüfung auf bereits geladenem Kontext. */
export function assertPermission<R extends PermissionResource>(
  ctx: OrgContext,
  resource: R,
  action: PermissionAction<R>,
): void {
  if (!roleHasPermission(ctx.role, resource, action)) {
    throw new PermissionError(
      `Rolle "${ctx.role}" darf "${String(resource)}.${String(action)}" nicht ausführen.`,
    );
  }
}
