/**
 * Plattform-Pläne (Spec §16). Diese Werte sind die Auslieferungs-Defaults;
 * über den Plattform-Admin sind sie in der Datenbank überschreibbar.
 */
export interface PlanSeed {
  key: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPricePerMonthCents: number;
  includedAgentSeats: number;
  includedRuns: number;
  includedAiCostDeciCents: number;
  maxTeamMembers: number | null;
  features: string[];
  setupFeeCents: number;
  sortOrder: number;
}

export const PLAN_SEEDS: PlanSeed[] = [
  {
    key: "starter",
    name: "Starter",
    description:
      "Für kleine Teams, die mit ein bis zwei digitalen Mitarbeitern starten.",
    monthlyPriceCents: 19900,
    yearlyPricePerMonthCents: 16900,
    includedAgentSeats: 1,
    includedRuns: 500,
    includedAiCostDeciCents: 20_000, // 20 €
    maxTeamMembers: 5,
    features: [
      "1 Agenten-Platz inklusive",
      "500 Agentenläufe pro Monat",
      "Demo-Connectoren, Webhooks und CSV",
      "Wissensbasis bis 100 Dokumente",
      "E-Mail-Support",
    ],
    setupFeeCents: 0,
    sortOrder: 1,
  },
  {
    key: "growth",
    name: "Growth",
    description:
      "Für wachsende Unternehmen mit mehreren Agenten und echten Integrationen.",
    monthlyPriceCents: 49900,
    yearlyPricePerMonthCents: 41900,
    includedAgentSeats: 3,
    includedRuns: 2500,
    includedAiCostDeciCents: 100_000, // 100 €
    maxTeamMembers: 25,
    features: [
      "3 Agenten-Plätze inklusive",
      "2.500 Agentenläufe pro Monat",
      "Alle verfügbaren Integrationen",
      "Wissensbasis bis 1.000 Dokumente",
      "Rollen, Freigaberegeln und Audit-Log",
      "Priorisierter Support",
    ],
    setupFeeCents: 49900,
    sortOrder: 2,
  },
  {
    key: "scale",
    name: "Scale",
    description:
      "Für Unternehmen, die komplette digitale Departments betreiben.",
    monthlyPriceCents: 129900,
    yearlyPricePerMonthCents: 109900,
    includedAgentSeats: 10,
    includedRuns: 10_000,
    includedAiCostDeciCents: 400_000, // 400 €
    maxTeamMembers: 100,
    features: [
      "10 Agenten-Plätze inklusive",
      "10.000 Agentenläufe pro Monat",
      "Department-Pakete mit Preisvorteil",
      "Unbegrenzte Wissensbasis",
      "Erweiterte Berichte und Exporte",
      "Onboarding-Begleitung",
    ],
    setupFeeCents: 99900,
    sortOrder: 3,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description:
      "Für größere Organisationen mit individuellen Anforderungen an Sicherheit und Betrieb.",
    monthlyPriceCents: 299900,
    yearlyPricePerMonthCents: 249900,
    includedAgentSeats: 25,
    includedRuns: 50_000,
    includedAiCostDeciCents: 1_500_000, // 1.500 €
    maxTeamMembers: null,
    features: [
      "25 Agenten-Plätze inklusive",
      "50.000 Agentenläufe pro Monat",
      "Individuelle Datenregion und Aufbewahrungsfristen",
      "Auftragsverarbeitungsvertrag und Unterauftragsverarbeiter-Übersicht",
      "Eigene Ansprechperson",
      "SLA nach Vereinbarung",
    ],
    setupFeeCents: 249900,
    sortOrder: 4,
  },
];

/** Jährliche Zahlung: prozentuale Ersparnis gegenüber monatlicher Zahlung. */
export function yearlySavingsPercent(p: {
  monthlyPriceCents: number;
  yearlyPricePerMonthCents: number;
}): number {
  if (p.monthlyPriceCents === 0) return 0;
  return Math.round(
    ((p.monthlyPriceCents - p.yearlyPricePerMonthCents) / p.monthlyPriceCents) *
      100,
  );
}

/** Gutscheincodes (Auslieferungs-Defaults; admin-seitig erweiterbar). */
export const COUPONS: Record<string, { percent: number; label: string }> = {
  START20: { percent: 20, label: "20 % Startrabatt für die ersten 3 Monate" },
  PILOT50: { percent: 50, label: "50 % Pilotphasen-Rabatt" },
};
