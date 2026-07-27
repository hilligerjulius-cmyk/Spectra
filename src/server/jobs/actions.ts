"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { withOrg } from "@/server/db/client";
import { agentInstance, agentSchedule } from "@/server/db/schema";
import { PermissionError, requirePermission } from "@/server/auth/guards";
import { getAgentDefinition } from "@/server/agents/catalog";
import { recordAudit } from "@/server/audit";
import { describeSchedule, isValidTimeZone, SCHEDULE_LIMITS } from "./schedule";

/**
 * Zeitpläne verwalten.
 *
 * Berechtigung ist `agents.configure` — wer einen Zeitplan anlegt, legt fest,
 * dass ein Agent unbeaufsichtigt läuft. Das ist eine Konfigurationsentscheidung,
 * keine Ausführung.
 */

export interface ScheduleActionResult {
  ok: boolean;
  message: string;
  scheduleId?: string;
}

function failure(err: unknown): ScheduleActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Zeitplan-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

const scheduleSchema = z
  .object({
    instanceId: z.string().min(1),
    capabilityKey: z.string().min(1).max(80),
    frequency: z.enum(SCHEDULE_LIMITS.frequencies),
    hour: z
      .number()
      .int()
      .min(SCHEDULE_LIMITS.minHour)
      .max(SCHEDULE_LIMITS.maxHour),
    minute: z
      .number()
      .int()
      .min(SCHEDULE_LIMITS.minMinute)
      .max(SCHEDULE_LIMITS.maxMinute),
    weekday: z
      .number()
      .int()
      .min(SCHEDULE_LIMITS.minWeekday)
      .max(SCHEDULE_LIMITS.maxWeekday)
      .nullable()
      .optional(),
    timezone: z.string().min(1).max(64),
  })
  .refine((v) => v.frequency !== "weekly" || typeof v.weekday === "number", {
    message: "Für einen wöchentlichen Zeitplan ist ein Wochentag nötig.",
    path: ["weekday"],
  });

export async function saveAgentSchedule(input: {
  instanceId: string;
  capabilityKey: string;
  frequency: string;
  hour: number;
  minute: number;
  weekday?: number | null;
  timezone: string;
}): Promise<ScheduleActionResult> {
  try {
    const ctx = await requirePermission("agents", "configure");
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message:
          parsed.error.issues[0]?.message ?? "Zeitplan ist nicht gültig.",
      };
    }
    const data = parsed.data;

    // Eine ungültige Zeitzone würde später jede Fälligkeitsprüfung verfälschen.
    if (!isValidTimeZone(data.timezone)) {
      return {
        ok: false,
        message: `Zeitzone "${data.timezone}" ist unbekannt. Bitte eine IANA-Zeitzone angeben, z. B. Europe/Berlin.`,
      };
    }

    // Agent und Fähigkeit müssen zur Organisation gehören.
    const [instance] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.id, data.instanceId)),
    );
    if (!instance) {
      return { ok: false, message: "Agent nicht gefunden." };
    }
    const definition = getAgentDefinition(instance.definitionSlug);
    const capability = definition?.capabilities.find(
      (c) => c.key === data.capabilityKey,
    );
    if (!capability) {
      return {
        ok: false,
        message: `Die Fähigkeit "${data.capabilityKey}" gehört nicht zu diesem Agenten.`,
      };
    }

    const spec = {
      frequency: data.frequency,
      hour: data.hour,
      minute: data.minute,
      weekday: data.weekday ?? null,
      timezone: data.timezone,
    };

    const [row] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .insert(agentSchedule)
        .values({
          organizationId: ctx.organizationId,
          agentInstanceId: data.instanceId,
          capabilityKey: data.capabilityKey,
          ...spec,
          enabled: true,
          createdByUserId: ctx.userId,
        })
        .onConflictDoUpdate({
          target: [agentSchedule.agentInstanceId, agentSchedule.capabilityKey],
          set: {
            ...spec,
            enabled: true,
            // Ein geänderter Zeitplan startet mit leerer Historie: Sonst würde
            // ein bereits gelaufenes Fenster den ersten Lauf unterdrücken.
            lastRunSlot: null,
            consecutiveFailures: 0,
            disabledReason: null,
          },
        })
        .returning({ id: agentSchedule.id }),
    );

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "schedule.saved",
      targetType: "agent_schedule",
      targetId: row!.id,
      summary: `Zeitplan für ${instance.displayName} (${capability.name}): ${describeSchedule(spec)}.`,
    });

    revalidatePath(`/app/agents/${data.instanceId}`);
    revalidatePath("/app/agents");
    return {
      ok: true,
      scheduleId: row!.id,
      message: `Zeitplan gespeichert: ${describeSchedule(spec)}. Der Lauf startet, sobald der Worker-Prozess läuft.`,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function setScheduleEnabled(
  scheduleId: string,
  enabled: boolean,
): Promise<ScheduleActionResult> {
  try {
    const ctx = await requirePermission("agents", "configure");
    const [row] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .update(agentSchedule)
        .set({
          enabled,
          // Beim Wiedereinschalten den Fehlerzähler zurücksetzen — sonst wäre
          // der Zeitplan nach einem weiteren Fehler sofort wieder aus.
          ...(enabled
            ? { consecutiveFailures: 0, disabledReason: null, lastRunSlot: null }
            : {}),
        })
        .where(eq(agentSchedule.id, scheduleId))
        .returning({ id: agentSchedule.id }),
    );
    if (!row) return { ok: false, message: "Zeitplan nicht gefunden." };

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: enabled ? "schedule.enabled" : "schedule.disabled",
      targetType: "agent_schedule",
      targetId: scheduleId,
      summary: enabled
        ? "Zeitplan wieder aktiviert."
        : "Zeitplan angehalten — geplante Läufe finden nicht mehr statt.",
    });

    revalidatePath("/app/agents");
    return {
      ok: true,
      message: enabled ? "Zeitplan aktiviert." : "Zeitplan angehalten.",
    };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteAgentSchedule(
  scheduleId: string,
): Promise<ScheduleActionResult> {
  try {
    const ctx = await requirePermission("agents", "configure");
    const [row] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .delete(agentSchedule)
        .where(eq(agentSchedule.id, scheduleId))
        .returning({ id: agentSchedule.id }),
    );
    if (!row) return { ok: false, message: "Zeitplan nicht gefunden." };

    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "schedule.deleted",
      targetType: "agent_schedule",
      targetId: scheduleId,
      summary: "Zeitplan entfernt.",
    });

    revalidatePath("/app/agents");
    return { ok: true, message: "Zeitplan entfernt." };
  } catch (err) {
    return failure(err);
  }
}

/** Zeitpläne eines Agenten — für die Detailseite. */
export async function listAgentSchedules(instanceId: string) {
  const ctx = await requirePermission("agents", "view");
  return withOrg(ctx.organizationId, (tx) =>
    tx
      .select()
      .from(agentSchedule)
      .where(
        and(
          eq(agentSchedule.agentInstanceId, instanceId),
          eq(agentSchedule.organizationId, ctx.organizationId),
        ),
      ),
  );
}
