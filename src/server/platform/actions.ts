"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { adminDb } from "@/server/db/client";
import { featureFlag, plan, priceOverride } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import {
  assertPlatformAccess,
  logSupportAccess,
  PlatformAccessError,
} from "./guards";

export interface PlatformActionResult {
  ok: boolean;
  message: string;
}

function failure(err: unknown): PlatformActionResult {
  if (err instanceof PlatformAccessError) {
    return { ok: false, message: err.message };
  }
  console.error("Plattform-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

const priceSchema = z.object({
  scope: z.enum(["tier", "department", "agent"]),
  targetKey: z.string().min(1).max(80),
  // Bis 100.000 € pro Monat; darüber ist ein Tippfehler wahrscheinlicher als eine Absicht.
  monthlyPriceCents: z.number().int().min(0).max(10_000_000),
  note: z.string().max(300).optional(),
});

export async function setPriceOverride(
  input: z.infer<typeof priceSchema>,
): Promise<PlatformActionResult> {
  try {
    const ctx = await assertPlatformAccess("admin");
    const parsed = priceSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, message: "Ungültiger Preis oder Ziel." };
    }
    await adminDb
      .insert(priceOverride)
      .values({
        scope: parsed.data.scope,
        targetKey: parsed.data.targetKey,
        monthlyPriceCents: parsed.data.monthlyPriceCents,
        note: parsed.data.note ?? null,
        updatedByUserId: ctx.userId,
      })
      .onConflictDoUpdate({
        target: [priceOverride.scope, priceOverride.targetKey],
        set: {
          monthlyPriceCents: parsed.data.monthlyPriceCents,
          note: parsed.data.note ?? null,
          updatedByUserId: ctx.userId,
        },
      });
    revalidatePath("/admin/preise");
    return {
      ok: true,
      message: `Preis für ${parsed.data.scope}:${parsed.data.targetKey} gesetzt. Er gilt ab der nächsten Berechnung für alle Organisationen.`,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function clearPriceOverride(
  scope: string,
  targetKey: string,
): Promise<PlatformActionResult> {
  try {
    await assertPlatformAccess("admin");
    // and() ist zwingend: "&&" zwischen zwei SQL-Bedingungen liefert in
    // JavaScript nur die zweite zurück und würde über alle Bereiche löschen.
    await adminDb
      .delete(priceOverride)
      .where(
        and(
          eq(priceOverride.scope, scope),
          eq(priceOverride.targetKey, targetKey),
        ),
      );
    revalidatePath("/admin/preise");
    return { ok: true, message: "Katalogpreis wiederhergestellt." };
  } catch (err) {
    return failure(err);
  }
}

const planSchema = z.object({
  key: z.string().min(1).max(40),
  monthlyPriceCents: z.number().int().min(0).max(10_000_000),
  yearlyPricePerMonthCents: z.number().int().min(0).max(10_000_000),
  includedAgentSeats: z.number().int().min(0).max(500),
  includedRuns: z.number().int().min(0).max(10_000_000),
  active: z.boolean(),
});

export async function updatePlan(
  input: z.infer<typeof planSchema>,
): Promise<PlatformActionResult> {
  try {
    await assertPlatformAccess("admin");
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Ungültige Plandaten." };
    if (parsed.data.yearlyPricePerMonthCents > parsed.data.monthlyPriceCents) {
      return {
        ok: false,
        message:
          "Der Jahrespreis pro Monat darf nicht über dem Monatspreis liegen — sonst wäre die Jahreszahlung teurer.",
      };
    }
    const updated = await adminDb
      .update(plan)
      .set({
        monthlyPriceCents: parsed.data.monthlyPriceCents,
        yearlyPricePerMonthCents: parsed.data.yearlyPricePerMonthCents,
        includedAgentSeats: parsed.data.includedAgentSeats,
        includedRuns: parsed.data.includedRuns,
        active: parsed.data.active,
      })
      .where(eq(plan.key, parsed.data.key))
      .returning({ name: plan.name });
    if (updated.length === 0) {
      return { ok: false, message: "Plan nicht gefunden." };
    }
    revalidatePath("/admin/preise");
    return { ok: true, message: `Plan "${updated[0]!.name}" aktualisiert.` };
  } catch (err) {
    return failure(err);
  }
}

const flagSchema = z.object({
  key: z.string().min(1).max(60),
  enabled: z.boolean(),
  organizationIds: z.array(z.string().max(60)).max(200),
});

export async function setFeatureFlag(
  input: z.infer<typeof flagSchema>,
): Promise<PlatformActionResult> {
  try {
    const ctx = await assertPlatformAccess("admin");
    const parsed = flagSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: "Ungültige Eingabe." };
    const updated = await adminDb
      .update(featureFlag)
      .set({
        enabled: parsed.data.enabled,
        organizationIds: parsed.data.organizationIds,
        updatedByUserId: ctx.userId,
      })
      .where(eq(featureFlag.key, parsed.data.key))
      .returning({ label: featureFlag.label });
    if (updated.length === 0) {
      return { ok: false, message: "Funktionsschalter nicht gefunden." };
    }
    revalidatePath("/admin/flags");
    return {
      ok: true,
      message: `"${updated[0]!.label}" ist jetzt ${parsed.data.enabled ? "aktiv" : "inaktiv"}${
        parsed.data.organizationIds.length > 0
          ? ` (${parsed.data.organizationIds.length} Organisation(en))`
          : ""
      }.`,
    };
  } catch (err) {
    return failure(err);
  }
}

const accessSchema = z.object({
  organizationId: z.string().min(1).max(80),
  reason: z.string().min(10).max(500),
  scope: z.string().min(1).max(80),
});

/**
 * Meldet einen Support-Einblick an. Ohne diesen Schritt gibt es keine
 * Kundendaten zu sehen — der Grund ist Pflicht und landet auch im Audit-Log
 * der betroffenen Organisation.
 */
export async function requestSupportAccess(
  input: z.infer<typeof accessSchema>,
): Promise<PlatformActionResult> {
  try {
    const ctx = await assertPlatformAccess("support");
    const parsed = accessSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message:
          "Bitte geben Sie einen nachvollziehbaren Grund an (mindestens 10 Zeichen).",
      };
    }
    await logSupportAccess({
      ctx,
      organizationId: parsed.data.organizationId,
      reason: parsed.data.reason,
      scope: parsed.data.scope,
    });
    revalidatePath("/admin/organisationen");
    return {
      ok: true,
      message:
        "Zugriff protokolliert — er ist auch im Audit-Log der Organisation sichtbar.",
    };
  } catch (err) {
    return failure(err);
  }
}

/**
 * Setzt eine Organisation zurück auf simulierte Abrechnung — Notbehelf,
 * falls ein Zahlungsanbieter ausfällt. Bewusst protokolliert.
 */
export async function forceMockBilling(
  organizationId: string,
  reason: string,
): Promise<PlatformActionResult> {
  try {
    const ctx = await assertPlatformAccess("admin");
    if (reason.trim().length < 10) {
      return { ok: false, message: "Bitte einen Grund angeben." };
    }
    const { subscription } = await import("@/server/db/schema");
    const updated = await adminDb
      .update(subscription)
      .set({ provider: "mock" })
      .where(eq(subscription.organizationId, organizationId))
      .returning({ id: subscription.id });
    if (updated.length === 0) {
      return { ok: false, message: "Kein Abonnement für diese Organisation." };
    }
    await recordAudit({
      organizationId,
      actorType: "system",
      actorId: ctx.userId,
      actorLabel: `Plattform-Admin: ${ctx.userLabel}`,
      action: "billing.provider.forced_mock",
      summary: `Abrechnung auf simulierten Betrieb umgestellt. Grund: ${reason.trim()}`,
    });
    revalidatePath("/admin/organisationen");
    return { ok: true, message: "Auf simulierte Abrechnung umgestellt." };
  } catch (err) {
    return failure(err);
  }
}
