import Stripe from "stripe";
import { env } from "@/lib/env";
import type {
  BillingProvider,
  CheckoutRequest,
  CheckoutResult,
  InvoiceDraft,
  InvoiceRequest,
} from "./types";

/**
 * Echter Stripe-Adapter (Test- und Live-Modus).
 *
 * Wird nur instanziiert, wenn `STRIPE_SECRET_KEY` gesetzt ist — siehe
 * `getBillingProvider()`. Es werden keine vorab angelegten Price-IDs
 * vorausgesetzt: Der serverseitig berechnete Monatsbetrag wird als
 * `price_data` inline übergeben. Das hält Katalog- und Rabattlogik an einer
 * Stelle (unserer Pricing-Engine) und vermeidet Preis-Drift zwischen
 * Stripe-Dashboard und Anwendung.
 *
 * Nicht getestet gegen die echte API: In dieser Umgebung liegt kein
 * Stripe-Testschlüssel vor (siehe TODO.md, Eintrag "Stripe-Abrechnung").
 */
export class StripeProvider implements BillingProvider {
  readonly key = "stripe" as const;
  readonly displayName = "Stripe";
  readonly isReal = true;
  readonly statusNote =
    "Abrechnung über Stripe. Zahlungsdaten werden ausschließlich bei Stripe verarbeitet und nicht in WORKFORCE OS gespeichert.";

  private readonly client: Stripe;

  constructor(secretKey: string) {
    // Ohne explizite apiVersion nutzt das SDK die zu ihm passende Version.
    this.client = new Stripe(secretKey);
  }

  /** Erkennt den Testmodus am Schlüsselpräfix (für UI-Kennzeichnung). */
  get isTestMode(): boolean {
    return env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ?? false;
  }

  async startCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const customer = await this.findOrCreateCustomer(request);

    const session = await this.client.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      client_reference_id: request.organizationId,
      success_url: `${request.returnUrl}?checkout=erfolgreich`,
      cancel_url: `${request.returnUrl}?checkout=abgebrochen`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount:
              request.billingInterval === "yearly"
                ? request.monthlyTotalCents * 12
                : request.monthlyTotalCents,
            recurring: {
              interval: request.billingInterval === "yearly" ? "year" : "month",
            },
            product_data: {
              name: `WORKFORCE OS — ${request.planKey}`,
              description:
                "Plattformgebühr inklusive gebuchter digitaler Mitarbeiter.",
            },
          },
        },
      ],
      subscription_data: {
        metadata: {
          organizationId: request.organizationId,
          planKey: request.planKey,
        },
      },
      metadata: {
        organizationId: request.organizationId,
        planKey: request.planKey,
        couponCode: request.couponCode ?? "",
      },
    });

    return {
      redirectUrl: session.url,
      externalCustomerId: customer.id,
      externalSubscriptionId:
        typeof session.subscription === "string" ? session.subscription : null,
      note: this.isTestMode
        ? "Stripe-Testmodus: Es werden keine echten Beträge abgebucht."
        : "Weiterleitung zur Zahlung bei Stripe.",
    };
  }

  private async findOrCreateCustomer(
    request: CheckoutRequest,
  ): Promise<Stripe.Customer> {
    const existing = await this.client.customers.search({
      query: `metadata['organizationId']:'${request.organizationId}'`,
      limit: 1,
    });
    if (existing.data[0]) return existing.data[0];
    return this.client.customers.create({
      name: request.organizationName,
      email: request.contactEmail,
      metadata: { organizationId: request.organizationId },
    });
  }

  async createInvoice(
    request: InvoiceRequest,
    lineItems: { label: string; amountCents: number }[],
  ): Promise<InvoiceDraft> {
    // Bei Stripe erzeugt das Abonnement die Rechnung. Wir spiegeln nur die
    // zuletzt bekannte Rechnung, damit die Oberfläche eine Historie zeigt.
    const invoices = request.externalSubscriptionId
      ? await this.client.invoices.list({
          limit: 1,
          subscription: request.externalSubscriptionId,
        })
      : { data: [] as Stripe.Invoice[] };
    const latest = invoices.data[0];
    const subtotal = lineItems.reduce((sum, l) => sum + l.amountCents, 0);
    return {
      number: latest?.number ?? `STRIPE-${Date.now()}`,
      periodStart: request.periodStart,
      periodEnd: request.periodEnd,
      subtotalCents: latest?.subtotal ?? subtotal,
      discountCents: Math.max(subtotal - request.monthlyTotalCents, 0),
      totalCents: latest?.total ?? request.monthlyTotalCents,
      lineItems,
      externalId: latest?.id ?? null,
    };
  }

  async cancelAtPeriodEnd(externalSubscriptionId: string | null): Promise<void> {
    if (!externalSubscriptionId) return;
    await this.client.subscriptions.update(externalSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async resume(externalSubscriptionId: string | null): Promise<void> {
    if (!externalSubscriptionId) return;
    await this.client.subscriptions.update(externalSubscriptionId, {
      cancel_at_period_end: false,
    });
  }
}
