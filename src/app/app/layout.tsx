import { eq } from "drizzle-orm";
import { requireOrg } from "@/server/auth/guards";
import { adminDb } from "@/server/db/client";
import { member, organization } from "@/server/db/schema";
import { AppShell } from "@/components/app-shell/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireOrg();

  // Alle Organisationen des Nutzers für den Org-Switcher
  const memberships = await adminDb
    .select({ id: organization.id, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, ctx.userId));

  const activeOrg = memberships.find((o) => o.id === ctx.organizationId) ?? {
    id: ctx.organizationId,
    name: "Organisation",
  };

  return (
    <AppShell
      user={{ name: ctx.session.user.name, email: ctx.session.user.email }}
      activeOrg={activeOrg}
      organizations={memberships}
      role={ctx.role}
    >
      {children}
    </AppShell>
  );
}
