import "server-only";
import { env, providerStatus } from "@/lib/env";
import { MockBillingProvider } from "./mock";
import { StripeProvider } from "./stripe";
import type { BillingProvider } from "./types";

export * from "./types";
export { MockBillingProvider } from "./mock";
export { StripeProvider } from "./stripe";

let cached: BillingProvider | null = null;

/**
 * Liefert den aktiven Abrechnungs-Provider.
 * Ohne `STRIPE_SECRET_KEY` läuft die Plattform mit simulierter Abrechnung —
 * vollständig bedienbar, aber ohne Zahlungsfluss (Spec §32.20).
 */
export function getBillingProvider(): BillingProvider {
  if (cached) return cached;
  cached =
    providerStatus.stripe && env.STRIPE_SECRET_KEY
      ? new StripeProvider(env.STRIPE_SECRET_KEY)
      : new MockBillingProvider();
  return cached;
}

/** Nur für Tests: erzwingt eine Neuauswertung der Umgebung. */
export function resetBillingProviderCache(): void {
  cached = null;
}
