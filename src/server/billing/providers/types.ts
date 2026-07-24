/**
 * Abrechnungs-Provider-Abstraktion.
 *
 * Zwei Implementierungen:
 *  - `MockBillingProvider`: vollständiger Lebenszyklus lokal in der Datenbank.
 *    Es fließt **kein Geld**; die Oberfläche kennzeichnet das als
 *    "Simulierte Abrechnung".
 *  - `StripeProvider`: echter Adapter gegen die Stripe-API. Aktiv nur, wenn
 *    `STRIPE_SECRET_KEY` gesetzt ist. Ohne Schlüssel wird er nicht geladen.
 */

export type BillingProviderKey = "mock" | "stripe";

export interface CheckoutRequest {
  organizationId: string;
  organizationName: string;
  planKey: string;
  billingInterval: "monthly" | "yearly";
  /** Serverseitig berechneter Monatsbetrag in Cent (inkl. Agenten/Rabatte). */
  monthlyTotalCents: number;
  couponCode?: string | null;
  returnUrl: string;
  contactEmail: string;
}

export interface CheckoutResult {
  /** Bei Stripe: Weiterleitung zur Checkout-Session. Bei Mock: null. */
  redirectUrl: string | null;
  externalCustomerId: string | null;
  externalSubscriptionId: string | null;
  /** Menschenlesbarer Hinweis für die Oberfläche. */
  note: string;
}

export interface InvoiceRequest extends CheckoutRequest {
  periodStart: Date;
  periodEnd: Date;
  externalSubscriptionId: string | null;
}

export interface InvoiceDraft {
  number: string;
  periodStart: Date;
  periodEnd: Date;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  lineItems: { label: string; amountCents: number }[];
  externalId: string | null;
}

export interface BillingProvider {
  readonly key: BillingProviderKey;
  readonly displayName: string;
  /** true = echte Zahlungen. false = Simulation, muss im UI kenntlich sein. */
  readonly isReal: boolean;
  /** Erklärtext für die Oberfläche. */
  readonly statusNote: string;

  /** Startet den Abschluss/Wechsel eines Plans. */
  startCheckout(request: CheckoutRequest): Promise<CheckoutResult>;

  /** Erzeugt eine Rechnung für die abgelaufene Periode. */
  createInvoice(
    request: InvoiceRequest,
    lineItems: { label: string; amountCents: number }[],
  ): Promise<InvoiceDraft>;

  /** Kündigt zum Periodenende. */
  cancelAtPeriodEnd(externalSubscriptionId: string | null): Promise<void>;

  /** Nimmt eine Kündigung zurück. */
  resume(externalSubscriptionId: string | null): Promise<void>;
}
