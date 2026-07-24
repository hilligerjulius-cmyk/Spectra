import {
  agentCatalog,
  departments,
  getAgentDefinition,
  getAgentsByDepartment,
  DEFAULT_TIER_PRICES_CENTS,
  type AgentDefinitionData,
  type DepartmentSlug,
} from "@/server/agents/catalog";

/**
 * Serverseitige Preislogik — der Client erhält ausschließlich berechnete
 * Ergebnisse und kontrolliert keine verbindliche Preisbildung.
 *
 * Mengenrabatt-Regeln (dokumentierte Annahme, admin-seitig änderbar geplant):
 *  - ab 5 Einzel-Agenten: 10 % auf die Agenten-Summe
 *  - ab 10 Einzel-Agenten: 15 %
 * Department-Pakete: Ist ein komplettes Department gewählt, gilt der
 * Paketpreis statt der Einzelsumme (immer die günstigere Variante).
 */

export function getAgentMonthlyPriceCents(def: AgentDefinitionData): number {
  return DEFAULT_TIER_PRICES_CENTS[def.priceTier];
}

export interface PricingLineItem {
  slug: string;
  name: string;
  monthlyCents: number;
}

export interface PricingBundle {
  department: DepartmentSlug;
  name: string;
  agentSlugs: string[];
  individualSumCents: number;
  bundleCents: number;
}

export interface TeamPricing {
  items: PricingLineItem[];
  bundles: PricingBundle[];
  agentSubtotalCents: number;
  volumeDiscountCents: number;
  volumeDiscountPercent: number;
  totalMonthlyCents: number;
  bundleSavingsCents: number;
}

export function computeTeamPricing(slugs: string[]): TeamPricing {
  const unique = [...new Set(slugs)];
  const defs = unique
    .map((slug) => getAgentDefinition(slug))
    .filter((d): d is AgentDefinitionData => Boolean(d));

  // 1. Komplette Departments als Paket erkennen (nur wenn günstiger)
  const bundles: PricingBundle[] = [];
  const bundled = new Set<string>();
  for (const dept of Object.values(departments)) {
    if (!dept.bundlePriceCents) continue;
    const deptAgents = getAgentsByDepartment(dept.slug);
    const allSelected = deptAgents.every((a) =>
      defs.some((d) => d.slug === a.slug),
    );
    if (!allSelected || deptAgents.length === 0) continue;
    const individualSum = deptAgents.reduce(
      (sum, a) => sum + getAgentMonthlyPriceCents(a),
      0,
    );
    if (dept.bundlePriceCents < individualSum) {
      bundles.push({
        department: dept.slug,
        name: dept.name,
        agentSlugs: deptAgents.map((a) => a.slug),
        individualSumCents: individualSum,
        bundleCents: dept.bundlePriceCents,
      });
      deptAgents.forEach((a) => bundled.add(a.slug));
    }
  }

  // 2. Restliche Agenten als Einzelposten
  const items: PricingLineItem[] = defs
    .filter((d) => !bundled.has(d.slug))
    .map((d) => ({
      slug: d.slug,
      name: `${d.personaName} — ${d.roleTitle}`,
      monthlyCents: getAgentMonthlyPriceCents(d),
    }));

  const itemSum = items.reduce((sum, i) => sum + i.monthlyCents, 0);

  // 3. Mengenrabatt auf Einzelposten
  const volumeDiscountPercent =
    items.length >= 10 ? 15 : items.length >= 5 ? 10 : 0;
  const volumeDiscountCents = Math.round(
    (itemSum * volumeDiscountPercent) / 100,
  );

  const bundleSum = bundles.reduce((sum, b) => sum + b.bundleCents, 0);
  const bundleSavingsCents = bundles.reduce(
    (sum, b) => sum + (b.individualSumCents - b.bundleCents),
    0,
  );

  return {
    items,
    bundles,
    agentSubtotalCents: itemSum + bundleSum,
    volumeDiscountCents,
    volumeDiscountPercent,
    totalMonthlyCents: itemSum - volumeDiscountCents + bundleSum,
    bundleSavingsCents,
  };
}

export function formatEuro(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Preisspannen je Stufe für Marketing-Darstellung. */
export function priceTierLabel(def: AgentDefinitionData): string {
  return formatEuro(getAgentMonthlyPriceCents(def));
}

export const allAgentPricing = agentCatalog.map((a) => ({
  slug: a.slug,
  monthlyCents: getAgentMonthlyPriceCents(a),
}));
