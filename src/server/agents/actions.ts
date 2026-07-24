"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/server/db/client";
import { agentInstance } from "@/server/db/schema";
import { requirePermission, PermissionError } from "@/server/auth/guards";
import { recordAudit } from "@/server/audit";
import {
  getAgentDefinition,
  getAgentsByDepartment,
  type DepartmentSlug,
} from "@/server/agents/catalog";

export interface ActionResult {
  ok: boolean;
  message: string;
  instanceId?: string;
}

function failure(err: unknown): ActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Agent-Action fehlgeschlagen:", err);
  return { ok: false, message: "Aktion fehlgeschlagen. Bitte erneut versuchen." };
}

/** Agent "einstellen": legt eine Instanz im Sandbox-Modus an. */
export async function hireAgent(slug: string): Promise<ActionResult> {
  try {
    const ctx = await requirePermission("agents", "activate");
    const def = getAgentDefinition(slug);
    if (!def) return { ok: false, message: "Unbekannter Agent." };

    const defaultTools = [
      ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
    ];
    const inserted = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(agentInstance)
        .values({
          organizationId: ctx.organizationId,
          definitionSlug: def.slug,
          displayName: def.personaName,
          status: "sandbox",
          allowedTools: defaultTools,
          responsibleUserId: ctx.userId,
        })
        .onConflictDoNothing()
        .returning({ id: agentInstance.id }),
    );
    if (inserted.length === 0) {
      return { ok: false, message: `${def.personaName} ist bereits Teil Ihres Teams.` };
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "agent.hired",
      targetType: "agent_instance",
      targetId: inserted[0]!.id,
      summary: `${def.personaName} (${def.roleTitle}) wurde eingestellt und startet im Sandbox-Modus.`,
    });
    revalidatePath("/app/workforce");
    revalidatePath("/app/marketplace");
    return {
      ok: true,
      message: `${def.personaName} wurde eingestellt (Sandbox-Modus).`,
      instanceId: inserted[0]!.id,
    };
  } catch (err) {
    return failure(err);
  }
}

/** Komplettes Department buchen (alle Agenten, die noch fehlen). */
export async function hireDepartment(
  department: DepartmentSlug,
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission("agents", "activate");
    const defs = getAgentsByDepartment(department);
    if (defs.length === 0) return { ok: false, message: "Unbekanntes Department." };
    let hired = 0;
    for (const def of defs) {
      const defaultTools = [
        ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
      ];
      const inserted = await withOrg(ctx.organizationId, (tx) =>
        tx
          .insert(agentInstance)
          .values({
            organizationId: ctx.organizationId,
            definitionSlug: def.slug,
            displayName: def.personaName,
            status: "sandbox",
            allowedTools: defaultTools,
            responsibleUserId: ctx.userId,
          })
          .onConflictDoNothing()
          .returning({ id: agentInstance.id }),
      );
      if (inserted.length > 0) {
        hired++;
        await recordAudit({
          organizationId: ctx.organizationId,
          actorType: "user",
          actorId: ctx.userId,
          actorLabel: ctx.session.user.name,
          action: "agent.hired",
          targetType: "agent_instance",
          targetId: inserted[0]!.id,
          summary: `${def.personaName} (${def.roleTitle}) wurde im Rahmen der Department-Buchung eingestellt.`,
        });
      }
    }
    revalidatePath("/app/workforce");
    revalidatePath("/app/marketplace");
    return {
      ok: true,
      message:
        hired > 0
          ? `${hired} Agenten eingestellt (Sandbox-Modus).`
          : "Alle Agenten dieses Departments sind bereits Teil Ihres Teams.",
    };
  } catch (err) {
    return failure(err);
  }
}

const statusSchema = z.enum(["active", "paused", "sandbox", "disabled"]);

/** Statuswechsel mit Sandbox-Schutz: aktiv erst nach bestandenem Testlauf. */
export async function setAgentStatus(
  instanceId: string,
  status: z.infer<typeof statusSchema>,
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission("agents", "activate");
    const parsed = statusSchema.safeParse(status);
    if (!parsed.success) return { ok: false, message: "Ungültiger Status." };

    const result = await withOrg(ctx.organizationId, async (tx) => {
      const [row] = await tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.id, instanceId));
      if (!row) return { ok: false as const, message: "Agent nicht gefunden." };
      if (
        parsed.data === "active" &&
        row.status === "sandbox" &&
        !row.sandboxPassedAt
      ) {
        return {
          ok: false as const,
          message:
            "Aktivierung erst nach bestandenem Sandbox-Testlauf möglich. Führen Sie zuerst einen Testlauf aus.",
        };
      }
      await tx
        .update(agentInstance)
        .set({
          status: parsed.data,
          activatedAt: parsed.data === "active" ? new Date() : row.activatedAt,
        })
        .where(eq(agentInstance.id, instanceId));
      return { ok: true as const, name: row.displayName };
    });
    if (!result.ok) return result;

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: `agent.status.${parsed.data}`,
      targetType: "agent_instance",
      targetId: instanceId,
      summary: `Status von ${result.name} wurde auf "${parsed.data}" gesetzt.`,
    });
    revalidatePath("/app/workforce");
    revalidatePath(`/app/agents/${instanceId}`);
    return { ok: true, message: `Status aktualisiert.` };
  } catch (err) {
    return failure(err);
  }
}

/** Automatisierungsstufe je Fähigkeit setzen (gedeckelt durch Katalog-Maximum). */
export async function setAutomationLevel(
  instanceId: string,
  capabilityKey: string,
  level: number,
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission("agents", "configure");
    const levelSchema = z.number().int().min(0).max(5);
    const parsedLevel = levelSchema.safeParse(level);
    if (!parsedLevel.success) return { ok: false, message: "Ungültige Stufe." };

    const result = await withOrg(ctx.organizationId, async (tx) => {
      const [row] = await tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.id, instanceId));
      if (!row) return { ok: false as const, message: "Agent nicht gefunden." };
      const def = getAgentDefinition(row.definitionSlug);
      const cap = def?.capabilities.find((c) => c.key === capabilityKey);
      if (!def || !cap) {
        return { ok: false as const, message: "Unbekannte Fähigkeit." };
      }
      if (parsedLevel.data > cap.maxAutomationLevel) {
        return {
          ok: false as const,
          message: `Diese Fähigkeit ist aus Sicherheitsgründen auf Stufe ${cap.maxAutomationLevel} begrenzt.`,
        };
      }
      await tx
        .update(agentInstance)
        .set({
          automationOverrides: {
            ...row.automationOverrides,
            [capabilityKey]: parsedLevel.data,
          },
          disabledCapabilities:
            parsedLevel.data === 0
              ? [...new Set([...row.disabledCapabilities, capabilityKey])]
              : row.disabledCapabilities.filter((k) => k !== capabilityKey),
        })
        .where(eq(agentInstance.id, instanceId));
      return {
        ok: true as const,
        name: row.displayName,
        capName: cap.name,
      };
    });
    if (!result.ok) return result;

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "agent.automation.changed",
      targetType: "agent_instance",
      targetId: instanceId,
      summary: `Automatisierungsstufe von "${result.capName}" (${result.name}) wurde auf ${level} gesetzt.`,
      metadata: { capabilityKey, level },
    });
    revalidatePath(`/app/agents/${instanceId}`);
    return { ok: true, message: "Automatisierungsstufe aktualisiert." };
  } catch (err) {
    return failure(err);
  }
}

/** Agent umbenennen. */
export async function renameAgent(
  instanceId: string,
  displayName: string,
): Promise<ActionResult> {
  try {
    const ctx = await requirePermission("agents", "configure");
    const nameSchema = z.string().trim().min(2).max(60);
    const parsed = nameSchema.safeParse(displayName);
    if (!parsed.success) {
      return { ok: false, message: "Name muss 2–60 Zeichen lang sein." };
    }
    const updated = await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(agentInstance)
        .set({ displayName: parsed.data })
        .where(eq(agentInstance.id, instanceId))
        .returning({ id: agentInstance.id }),
    );
    if (updated.length === 0) return { ok: false, message: "Agent nicht gefunden." };
    revalidatePath(`/app/agents/${instanceId}`);
    revalidatePath("/app/workforce");
    return { ok: true, message: "Name aktualisiert." };
  } catch (err) {
    return failure(err);
  }
}

/** Agent aus dem Team entfernen (Instanz löschen; Audit-Historie bleibt). */
export async function removeAgent(instanceId: string): Promise<ActionResult> {
  try {
    const ctx = await requirePermission("agents", "activate");
    const deleted = await withOrg(ctx.organizationId, (tx) =>
      tx
        .delete(agentInstance)
        .where(eq(agentInstance.id, instanceId))
        .returning({ name: agentInstance.displayName, slug: agentInstance.definitionSlug }),
    );
    if (deleted.length === 0) return { ok: false, message: "Agent nicht gefunden." };
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "agent.removed",
      targetType: "agent_instance",
      targetId: instanceId,
      summary: `${deleted[0]!.name} (${deleted[0]!.slug}) wurde aus dem Team entfernt.`,
    });
    revalidatePath("/app/workforce");
    revalidatePath("/app/marketplace");
    return { ok: true, message: "Agent entfernt." };
  } catch (err) {
    return failure(err);
  }
}
