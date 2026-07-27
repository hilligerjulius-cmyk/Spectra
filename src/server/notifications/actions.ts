"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg, PermissionError } from "@/server/auth/guards";
import {
  NOTIFICATION_TYPE_KEYS,
  markRead,
  sendDigest,
  updatePreference,
} from "./service";

export interface NotificationActionResult {
  ok: boolean;
  message: string;
}

function failure(err: unknown): NotificationActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Notification-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

export async function markNotificationRead(
  notificationId?: string,
): Promise<NotificationActionResult> {
  try {
    const ctx = await requireOrg();
    const count = await markRead(ctx.organizationId, ctx.userId, notificationId);
    revalidatePath("/app/notifications");
    revalidatePath("/app");
    return {
      ok: true,
      message: notificationId
        ? "Als gelesen markiert."
        : `${count} Meldung(en) als gelesen markiert.`,
    };
  } catch (err) {
    return failure(err);
  }
}

const preferenceSchema = z.object({
  inAppTypes: z.array(z.enum(NOTIFICATION_TYPE_KEYS)).max(20),
  emailTypes: z.array(z.enum(NOTIFICATION_TYPE_KEYS)).max(20),
  dailyDigest: z.boolean(),
  // Format UND Gültigkeit: 99:99 hat das richtige Muster, ist aber keine Uhrzeit.
  digestHour: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Bitte eine gültige Uhrzeit angeben."),
});

/**
 * Der Parametertyp ist absichtlich weit: Was vom Client kommt, ist ungeprüft,
 * und ein enger Typ würde nur vortäuschen, dass er das nicht ist. Die
 * Einschränkung auf gültige Typschlüssel leistet `preferenceSchema`
 * serverseitig.
 */
export async function saveNotificationPreference(input: {
  inAppTypes: string[];
  emailTypes: string[];
  dailyDigest: boolean;
  digestHour: string;
}): Promise<NotificationActionResult> {
  try {
    const ctx = await requireOrg();
    const parsed = preferenceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: "Ungültige Einstellungen." };
    }
    await updatePreference({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      ...parsed.data,
    });
    revalidatePath("/app/settings");
    return { ok: true, message: "Einstellungen gespeichert." };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Zusammenfassung sofort erzeugen — nützlich zum Prüfen der Einstellungen,
 * bevor der geplante Versand greift.
 */
export async function sendDigestNow(): Promise<NotificationActionResult> {
  try {
    const ctx = await requireOrg();
    const result = await sendDigest(ctx.organizationId, ctx.userId);
    if (result.skippedReason) {
      return { ok: false, message: result.skippedReason };
    }
    return {
      ok: true,
      message: result.delivered
        ? `Zusammenfassung mit ${result.items} Meldung(en) versendet.`
        : `Zusammenfassung mit ${result.items} Meldung(en) im Postausgang abgelegt — ohne SMTP-Zugang wird nicht versendet.`,
    };
  } catch (err) {
    return failure(err);
  }
}
