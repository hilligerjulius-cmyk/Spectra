"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/server/auth/auth";
import { requireOrg, requirePermission, PermissionError } from "@/server/auth/guards";
import { ALL_ROLES, type OrgRole } from "@/server/auth/permissions";
import { adminDb } from "@/server/db/client";
import { invitation, member } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";

export interface TeamActionResult {
  ok: boolean;
  message: string;
}

function failure(err: unknown): TeamActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Team-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

const inviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(ALL_ROLES as [OrgRole, ...OrgRole[]]),
});

export async function inviteMember(
  input: z.infer<typeof inviteSchema>,
): Promise<TeamActionResult> {
  try {
    const ctx = await requirePermission("settings", "manage");
    const parsed = inviteSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: "Bitte eine gültige E-Mail-Adresse und Rolle angeben." };
    }

    // Better Auth versendet die Einladung (bzw. legt sie in der Outbox ab).
    const result = await auth.api.createInvitation({
      headers: await headers(),
      body: {
        email: parsed.data.email,
        role: parsed.data.role,
        organizationId: ctx.organizationId,
      },
    });

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "team.invited",
      targetType: "invitation",
      targetId: result.id,
      summary: `${parsed.data.email} wurde als "${parsed.data.role}" eingeladen.`,
    });
    revalidatePath("/app/team");
    return {
      ok: true,
      message: `Einladung an ${parsed.data.email} erstellt.`,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function revokeInvitation(
  invitationId: string,
): Promise<TeamActionResult> {
  try {
    const ctx = await requirePermission("settings", "manage");
    const updated = await adminDb
      .update(invitation)
      .set({ status: "canceled" })
      .where(
        and(
          eq(invitation.id, invitationId),
          eq(invitation.organizationId, ctx.organizationId),
        ),
      )
      .returning({ email: invitation.email });
    if (updated.length === 0) {
      return { ok: false, message: "Einladung nicht gefunden." };
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "team.invitation_revoked",
      targetType: "invitation",
      targetId: invitationId,
      summary: `Einladung an ${updated[0]!.email} zurückgezogen.`,
    });
    revalidatePath("/app/team");
    return { ok: true, message: "Einladung zurückgezogen." };
  } catch (err) {
    return failure(err);
  }
}

const roleChangeSchema = z.object({
  memberId: z.string().min(1),
  role: z.enum(ALL_ROLES as [OrgRole, ...OrgRole[]]),
});

export async function changeMemberRole(
  input: z.infer<typeof roleChangeSchema>,
): Promise<TeamActionResult> {
  try {
    const ctx = await requirePermission("settings", "manage");
    const parsed = roleChangeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };

    const [target] = await adminDb
      .select()
      .from(member)
      .where(
        and(
          eq(member.id, parsed.data.memberId),
          eq(member.organizationId, ctx.organizationId),
        ),
      );
    if (!target) return { ok: false, message: "Mitglied nicht gefunden." };

    // Die letzte Inhaberin darf ihre Rolle nicht verlieren — sonst bliebe die
    // Organisation ohne Vollzugriff zurück.
    if (target.role === "owner" && parsed.data.role !== "owner") {
      const owners = await adminDb
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, ctx.organizationId),
            eq(member.role, "owner"),
          ),
        );
      if (owners.length <= 1) {
        return {
          ok: false,
          message:
            "Die letzte Inhaberin bzw. der letzte Inhaber kann die Rolle nicht abgeben. Ernennen Sie zuerst eine weitere Person zum Owner.",
        };
      }
    }

    await adminDb
      .update(member)
      .set({ role: parsed.data.role })
      .where(eq(member.id, parsed.data.memberId));

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "team.role_changed",
      targetType: "member",
      targetId: parsed.data.memberId,
      summary: `Rolle von "${target.role}" auf "${parsed.data.role}" geändert.`,
      metadata: { previousRole: target.role, newRole: parsed.data.role },
    });
    revalidatePath("/app/team");
    return { ok: true, message: "Rolle aktualisiert." };
  } catch (err) {
    return failure(err);
  }
}

export async function removeMember(
  memberId: string,
): Promise<TeamActionResult> {
  try {
    const ctx = await requirePermission("settings", "manage");
    const [target] = await adminDb
      .select()
      .from(member)
      .where(
        and(
          eq(member.id, memberId),
          eq(member.organizationId, ctx.organizationId),
        ),
      );
    if (!target) return { ok: false, message: "Mitglied nicht gefunden." };
    if (target.userId === ctx.userId) {
      return {
        ok: false,
        message:
          "Sie können sich nicht selbst entfernen. Übertragen Sie zuerst die Verantwortung.",
      };
    }
    if (target.role === "owner") {
      const owners = await adminDb
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, ctx.organizationId),
            eq(member.role, "owner"),
          ),
        );
      if (owners.length <= 1) {
        return {
          ok: false,
          message: "Die letzte Inhaberin bzw. der letzte Inhaber kann nicht entfernt werden.",
        };
      }
    }

    await adminDb.delete(member).where(eq(member.id, memberId));
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "team.member_removed",
      targetType: "member",
      targetId: memberId,
      summary: `Mitglied (Rolle "${target.role}") wurde aus der Organisation entfernt.`,
    });
    revalidatePath("/app/team");
    return { ok: true, message: "Mitglied entfernt." };
  } catch (err) {
    return failure(err);
  }
}

/** Nimmt eine Einladung an (aufgerufen von /einladung/[id]). */
export async function acceptInvitation(
  invitationId: string,
): Promise<TeamActionResult> {
  try {
    const result = await auth.api.acceptInvitation({
      headers: await headers(),
      body: { invitationId },
    });
    if (!result?.invitation) {
      return { ok: false, message: "Einladung konnte nicht angenommen werden." };
    }
    await recordAudit({
      organizationId: result.invitation.organizationId,
      actorType: "user",
      actorLabel: result.invitation.email,
      action: "team.invitation_accepted",
      targetType: "invitation",
      targetId: invitationId,
      summary: `Einladung angenommen (Rolle "${result.invitation.role}").`,
    });
    return { ok: true, message: "Einladung angenommen." };
  } catch (err) {
    return failure(err);
  }
}

/** Verlässt die aktive Organisation (nicht für die letzte Inhaberin). */
export async function leaveOrganization(): Promise<TeamActionResult> {
  try {
    const ctx = await requireOrg();
    if (ctx.role === "owner") {
      const owners = await adminDb
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, ctx.organizationId),
            eq(member.role, "owner"),
          ),
        );
      if (owners.length <= 1) {
        return {
          ok: false,
          message:
            "Als letzte Inhaberin bzw. letzter Inhaber können Sie die Organisation nicht verlassen.",
        };
      }
    }
    await adminDb
      .delete(member)
      .where(
        and(
          eq(member.organizationId, ctx.organizationId),
          eq(member.userId, ctx.userId),
        ),
      );
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "team.member_left",
      summary: `${ctx.session.user.name} hat die Organisation verlassen.`,
    });
    return { ok: true, message: "Sie haben die Organisation verlassen." };
  } catch (err) {
    return failure(err);
  }
}
