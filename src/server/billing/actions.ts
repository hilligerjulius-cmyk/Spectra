"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requirePermission, PermissionError } from "@/server/auth/guards";
import { adminDb } from "@/server/db/client";
import { organization } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import {
  applyCoupon,
  cancelSubscription,
  changePlan,
  issueInvoice,
  removeCoupon,
  resumeSubscription,
} from "./service";

export interface BillingActionResult {
  ok: boolean;
  message: string;
  redirectUrl?: string | null;
}

function failure(err: unknown): BillingActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Billing-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

/** Lädt Organisationsname und Kontakt-E-Mail für den Abrechnungs-Provider. */
async function billingIdentity(organizationId: string, fallbackEmail: string) {
  const [org] = await adminDb
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId));
  return {
    organizationName: org?.name ?? "Unbenannte Organisation",
    contactEmail: fallbackEmail,
  };
}

export async function selectPlan(
  planKey: string,
  billingInterval: "monthly" | "yearly",
): Promise<BillingActionResult> {
  try {
    const ctx = await requirePermission("billing", "manage");
    if (billingInterval !== "monthly" && billingInterval !== "yearly") {
      return { ok: false, message: "Ungültiges Abrechnungsintervall." };
    }
    const identity = await billingIdentity(
      ctx.organizationId,
      ctx.session.user.email,
    );
    const result = await changePlan({
      organizationId: ctx.organizationId,
      planKey,
      billingInterval,
      ...identity,
    });
    if (result.ok) {
      await recordAudit({
        organizationId: ctx.organizationId,
        actorType: "user",
        actorId: ctx.userId,
        actorLabel: ctx.session.user.name,
        action: "billing.plan.changed",
        targetType: "subscription",
        targetId: ctx.organizationId,
        summary: `Plan auf "${planKey}" (${billingInterval === "yearly" ? "Jahreszahlung" : "monatlich"}) gewechselt.`,
      });
      revalidatePath("/app/billing");
    }
    return result;
  } catch (err) {
    return failure(err);
  }
}

export async function redeemCoupon(code: string): Promise<BillingActionResult> {
  try {
    const ctx = await requirePermission("billing", "manage");
    const result = await applyCoupon(ctx.organizationId, code);
    if (result.ok) {
      await recordAudit({
        organizationId: ctx.organizationId,
        actorType: "user",
        actorId: ctx.userId,
        actorLabel: ctx.session.user.name,
        action: "billing.coupon.applied",
        summary: result.message,
      });
      revalidatePath("/app/billing");
    }
    return result;
  } catch (err) {
    return failure(err);
  }
}

export async function clearCoupon(): Promise<BillingActionResult> {
  try {
    const ctx = await requirePermission("billing", "manage");
    await removeCoupon(ctx.organizationId);
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "billing.coupon.removed",
      summary: "Gutschein entfernt.",
    });
    revalidatePath("/app/billing");
    return { ok: true, message: "Gutschein entfernt." };
  } catch (err) {
    return failure(err);
  }
}

export async function cancelPlan(): Promise<BillingActionResult> {
  try {
    const ctx = await requirePermission("billing", "manage");
    const result = await cancelSubscription(ctx.organizationId);
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "billing.subscription.cancel_requested",
      summary: result.message,
    });
    revalidatePath("/app/billing");
    return result;
  } catch (err) {
    return failure(err);
  }
}

export async function resumePlan(): Promise<BillingActionResult> {
  try {
    const ctx = await requirePermission("billing", "manage");
    const result = await resumeSubscription(ctx.organizationId);
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "billing.subscription.resumed",
      summary: result.message,
    });
    revalidatePath("/app/billing");
    return result;
  } catch (err) {
    return failure(err);
  }
}

export async function createInvoiceForCurrentPeriod(): Promise<BillingActionResult> {
  try {
    const ctx = await requirePermission("billing", "manage");
    const identity = await billingIdentity(
      ctx.organizationId,
      ctx.session.user.email,
    );
    const result = await issueInvoice({
      organizationId: ctx.organizationId,
      ...identity,
    });
    if (result.ok) {
      await recordAudit({
        organizationId: ctx.organizationId,
        actorType: "user",
        actorId: ctx.userId,
        actorLabel: ctx.session.user.name,
        action: "billing.invoice.issued",
        targetType: "invoice",
        targetId: result.invoiceNumber ?? null,
        summary: result.message,
      });
      revalidatePath("/app/billing");
    }
    return result;
  } catch (err) {
    return failure(err);
  }
}
