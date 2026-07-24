"use server";

import { z } from "zod";
import {
  allCatalogSlugs,
  computeRecommendation,
  configuratorAnswersSchema,
  type ConfiguratorRecommendation,
} from "./logic";
import { computeTeamPricing, type TeamPricing } from "@/server/billing/pricing";

export interface ConfiguratorResult {
  recommendation: ConfiguratorRecommendation;
  pricing: TeamPricing;
  selectedSlugs: string[];
}

const overridesSchema = z
  .object({
    added: z.array(z.string()).max(60).default([]),
    removed: z.array(z.string()).max(60).default([]),
  })
  .default({ added: [], removed: [] });

/**
 * Berechnet Empfehlung + serverseitige Preise. `overrides` erlaubt dem Nutzer,
 * Agenten hinzuzufügen/zu entfernen — die Preisbildung bleibt serverseitig.
 */
export async function computeConfiguratorResult(
  rawAnswers: unknown,
  rawOverrides?: unknown,
): Promise<ConfiguratorResult> {
  const answers = configuratorAnswersSchema.parse(rawAnswers);
  const overrides = overridesSchema.parse(rawOverrides ?? {});

  const recommendation = computeRecommendation(answers);

  const selected = new Set(recommendation.agents.map((a) => a.slug));
  for (const slug of overrides.added) {
    if (allCatalogSlugs.has(slug)) selected.add(slug);
  }
  for (const slug of overrides.removed) {
    selected.delete(slug);
  }

  const selectedSlugs = [...selected];
  return {
    recommendation,
    pricing: computeTeamPricing(selectedSlugs),
    selectedSlugs,
  };
}
