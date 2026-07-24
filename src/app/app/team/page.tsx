import { and, eq } from "drizzle-orm";
import { requireOrg } from "@/server/auth/guards";
import { ALL_ROLES, roleHasPermission } from "@/server/auth/permissions";
import { adminDb } from "@/server/db/client";
import { invitation, member, user } from "@/server/db/schema";
import { mailProviderInfo } from "@/server/notifications/service";
import { PageHeader } from "@/components/shared/page-header";
import { TeamView, type InvitationView, type MemberView } from "./team-view";

export const metadata = { title: "Team" };

const roleDescriptions: Record<string, string> = {
  owner:
    "Vollzugriff inklusive Abrechnung, Eigentumsübertragung und Löschung der Organisation.",
  admin:
    "Wie Owner, jedoch ohne Abrechnungsverwaltung, Eigentumsübertragung und Löschung.",
  manager:
    "Überwacht Departments, entscheidet Freigaben und konfiguriert zugewiesene Agenten.",
  member: "Nutzt Agenten und erteilt Freigaben, soweit berechtigt.",
  viewer: "Ausschließlich lesender Zugriff auf alle Bereiche.",
  billingAdmin:
    "Verwaltet ausschließlich die Abrechnung; kein Zugriff auf operative Unternehmensdaten.",
};

export default async function TeamPage() {
  const ctx = await requireOrg();
  const canManage = roleHasPermission(ctx.role, "settings", "manage");

  // Mitgliedschaften liegen in den Auth-Tabellen, auf die die RLS-Rolle
  // bewusst keinen Zugriff hat — daher über die Owner-Verbindung, hart auf
  // die aktive Organisation gefiltert.
  const rows = await adminDb
    .select({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt,
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, ctx.organizationId));

  const pendingInvitations = await adminDb
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, ctx.organizationId),
        eq(invitation.status, "pending"),
      ),
    );

  const members: MemberView[] = rows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      email: r.email,
      role: r.role,
      isSelf: r.userId === ctx.userId,
      joinedAt: r.createdAt.toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  const invitations: InvitationView[] = pendingInvitations.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role ?? "member",
    status: i.status,
    expiresAt: i.expiresAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Wer arbeitet mit — und wer darf entscheiden. Berechtigungen werden serverseitig geprüft."
      />
      <TeamView
        members={members}
        invitations={invitations}
        roles={[...ALL_ROLES]}
        roleDescriptions={roleDescriptions}
        canManage={canManage}
        emailIsReal={mailProviderInfo().isReal}
      />
    </div>
  );
}
