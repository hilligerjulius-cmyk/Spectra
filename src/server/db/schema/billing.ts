import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Plattform-Pläne (global, admin-verwaltbar). Preise werden ausschließlich
 * serverseitig berechnet; der Client erhält nur Ergebnisse.
 */
export const plan = pgTable(
  "plan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** starter | growth | scale | enterprise */
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    monthlyPriceCents: integer("monthly_price_cents").notNull(),
    /** Jahrespreis pro Monat (Rabatt gegenüber monatlicher Zahlung). */
    yearlyPricePerMonthCents: integer("yearly_price_per_month_cents").notNull(),
    /** Enthaltene Agenten-Plätze (0 = keine inklusive). */
    includedAgentSeats: integer("included_agent_seats").notNull().default(0),
    /** Enthaltene Agentenläufe pro Monat. */
    includedRuns: integer("included_runs").notNull(),
    /** Monatliches KI-Kostenkontingent in Zehntel-Cent. */
    includedAiCostDeciCents: integer("included_ai_cost_deci_cents").notNull(),
    maxTeamMembers: integer("max_team_members"),
    features: jsonb("features").$type<string[]>().notNull().default([]),
    /** Einmalige Einrichtungsgebühr. */
    setupFeeCents: integer("setup_fee_cents").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("plan_key_uidx").on(t.key)],
);

/**
 * Preis-Overrides je Agent bzw. Department-Paket (admin-verwaltbar).
 * Ohne Eintrag gilt der Katalogpreis der Preisstufe.
 */
export const priceOverride = pgTable(
  "price_override",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    /** agent | department | tier */
    scope: text("scope").notNull(),
    /** Agent-Slug, Department-Slug oder Preisstufe. */
    targetKey: text("target_key").notNull(),
    monthlyPriceCents: integer("monthly_price_cents").notNull(),
    note: text("note"),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("price_override_uidx").on(t.scope, t.targetKey)],
);

/** Abonnement einer Organisation. */
export const subscription = pgTable(
  "subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
      .unique(),
    planKey: text("plan_key").notNull(),
    /** trialing | active | past_due | canceled */
    status: text("status").notNull().default("trialing"),
    /** monthly | yearly */
    billingInterval: text("billing_interval").notNull().default("monthly"),
    /** stripe | mock — welcher Provider das Abo führt. */
    provider: text("provider").notNull().default("mock"),
    externalCustomerId: text("external_customer_id"),
    externalSubscriptionId: text("external_subscription_id"),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** Prozentualer Gutschein-Rabatt (0–100). */
    discountPercent: integer("discount_percent").notNull().default(0),
    couponCode: text("coupon_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("subscription_org_idx").on(t.organizationId)],
);

/** Verbrauchsdatensätze für Nutzungslimits und Kostentransparenz. */
export const usageRecord = pgTable(
  "usage_record",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Abrechnungsperiode als YYYY-MM. */
    period: text("period").notNull(),
    /** agent_run | ai_cost */
    metric: text("metric").notNull(),
    value: integer("value").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("usage_record_uidx").on(t.organizationId, t.period, t.metric),
  ],
);

/** Rechnungen (Mock-Provider erzeugt sie lokal, Stripe spiegelt sie). */
export const invoiceRecord = pgTable(
  "invoice_record",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    /** draft | open | paid | void */
    status: text("status").notNull().default("open"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    lineItems: jsonb("line_items")
      .$type<{ label: string; amountCents: number }[]>()
      .notNull()
      .default([]),
    provider: text("provider").notNull().default("mock"),
    externalId: text("external_id"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("invoice_org_idx").on(t.organizationId, t.issuedAt)],
);
