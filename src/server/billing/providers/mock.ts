import type {
  BillingProvider,
  CheckoutRequest,
  CheckoutResult,
  InvoiceDraft,
  InvoiceRequest,
} from "./types";

/**
 * Simulierte Abrechnung: bildet den vollständigen Lebenszyklus lokal ab,
 * ohne Zahlungsdienstleister. Es wird **nichts** abgebucht. Die Oberfläche
 * weist an jeder Stelle darauf hin (siehe `statusNote`).
 */
export class MockBillingProvider implements BillingProvider {
  readonly key = "mock" as const;
  readonly displayName = "Simulierte Abrechnung";
  readonly isReal = false;
  readonly statusNote =
    "Simulierte Abrechnung: Pläne, Rechnungen und Kündigungen werden lokal geführt. " +
    "Es findet keine echte Zahlung statt. Für echte Abrechnung wird ein Stripe-Schlüssel (STRIPE_SECRET_KEY) benötigt.";

  async startCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    return {
      redirectUrl: null,
      externalCustomerId: `mock_cus_${request.organizationId.slice(0, 12)}`,
      externalSubscriptionId: `mock_sub_${request.planKey}_${Date.now()}`,
      note: `Plan "${request.planKey}" wurde simuliert aktiviert. Es wurde keine Zahlung ausgelöst.`,
    };
  }

  async createInvoice(
    request: InvoiceRequest,
    lineItems: { label: string; amountCents: number }[],
  ): Promise<InvoiceDraft> {
    const subtotal = lineItems.reduce((sum, l) => sum + l.amountCents, 0);
    const discount = Math.max(subtotal - request.monthlyTotalCents, 0);
    const period = `${request.periodStart.getUTCFullYear()}${String(
      request.periodStart.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    return {
      number: `SIM-${period}-${request.organizationId.slice(0, 6).toUpperCase()}`,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      subtotalCents: subtotal,
      discountCents: discount,
      totalCents: request.monthlyTotalCents,
      lineItems,
      externalId: null,
    };
  }

  async cancelAtPeriodEnd(): Promise<void> {
    // Lokal geführt: der Status wird im Service gesetzt, hier ist nichts zu tun.
  }

  async resume(): Promise<void> {
    // Siehe cancelAtPeriodEnd.
  }
}
