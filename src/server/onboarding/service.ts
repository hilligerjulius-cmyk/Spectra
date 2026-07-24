import "server-only";
import { eq } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import { agentInstance, onboardingState } from "@/server/db/schema";
import { getAgentDefinition } from "@/server/agents/catalog";
import {
  computeRecommendation,
  configuratorAnswersSchema,
  type ConfiguratorAnswers,
  type ConfiguratorRecommendation,
} from "@/server/configurator/logic";
import { computeTeamPricing, type TeamPricing } from "@/server/billing/pricing";
import { ONBOARDING_STEPS, ONBOARDING_STEP_COUNT } from "./steps";

export type OnboardingRow = typeof onboardingState.$inferSelect;

/** Lädt den Zustand; legt ihn beim ersten Aufruf an. */
export async function getOrCreateOnboarding(
  organizationId: string,
  userId: string,
): Promise<OnboardingRow> {
  const existing = await withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(onboardingState)
      .where(eq(onboardingState.organizationId, organizationId)),
  );
  if (existing[0]) return existing[0];

  const inserted = await withOrg(organizationId, (tx) =>
    tx
      .insert(onboardingState)
      .values({ organizationId, startedByUserId: userId })
      .onConflictDoNothing()
      .returning(),
  );
  if (inserted[0]) return inserted[0];

  // Rennen mit einem parallelen Aufruf — jetzt existiert die Zeile sicher.
  const [row] = await withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(onboardingState)
      .where(eq(onboardingState.organizationId, organizationId)),
  );
  return row!;
}

export interface SaveStepInput {
  organizationId: string;
  stepKey: string;
  /** Nächster anzuzeigender Schritt (1-basiert). */
  nextStep: number;
  answers?: Partial<ConfiguratorAnswers>;
  selectedAgents?: string[];
}

export async function saveStep(input: SaveStepInput): Promise<OnboardingRow> {
  const current = await withOrg(input.organizationId, (tx) =>
    tx
      .select()
      .from(onboardingState)
      .where(eq(onboardingState.organizationId, input.organizationId)),
  );
  const row = current[0];
  if (!row) throw new Error("Einrichtung wurde nicht gestartet.");

  const completed = [...new Set([...row.completedSteps, input.stepKey])];
  const nextStep = Math.min(
    Math.max(input.nextStep, 1),
    ONBOARDING_STEP_COUNT,
  );

  const mergedAnswers = input.answers
    ? { ...row.answers, ...input.answers }
    : row.answers;

  // Nur bekannte Katalog-Slugs übernehmen (der Client darf nichts erfinden).
  const selected = input.selectedAgents
    ? input.selectedAgents.filter((s) => Boolean(getAgentDefinition(s)))
    : row.selectedAgents;

  const [updated] = await withOrg(input.organizationId, (tx) =>
    tx
      .update(onboardingState)
      .set({
        completedSteps: completed,
        currentStep: Math.max(nextStep, row.currentStep),
        answers: mergedAnswers,
        selectedAgents: selected,
      })
      .where(eq(onboardingState.organizationId, input.organizationId))
      .returning(),
  );
  return updated!;
}

export async function markCompleted(organizationId: string): Promise<void> {
  await withOrg(organizationId, (tx) =>
    tx
      .update(onboardingState)
      .set({
        completed: true,
        completedAt: new Date(),
        currentStep: ONBOARDING_STEP_COUNT,
        completedSteps: ONBOARDING_STEPS.map((s) => s.key),
      })
      .where(eq(onboardingState.organizationId, organizationId)),
  );
}

/** Antworten robust parsen — unvollständige Zwischenstände sind erlaubt. */
export function parseAnswers(raw: Record<string, unknown>): ConfiguratorAnswers {
  const parsed = configuratorAnswersSchema.safeParse(raw);
  return parsed.success ? parsed.data : configuratorAnswersSchema.parse({});
}

export interface OnboardingOverview {
  state: OnboardingRow;
  answers: ConfiguratorAnswers;
  recommendation: ConfiguratorRecommendation;
  pricing: TeamPricing;
  /** Bereits angelegte Agenten der Organisation. */
  instances: {
    id: string;
    slug: string;
    displayName: string;
    status: string;
    sandboxPassed: boolean;
  }[];
}

export async function loadOverview(
  organizationId: string,
  userId: string,
): Promise<OnboardingOverview> {
  const state = await getOrCreateOnboarding(organizationId, userId);
  const answers = parseAnswers(state.answers);
  const recommendation = computeRecommendation(answers);
  const selected =
    state.selectedAgents.length > 0
      ? state.selectedAgents
      : recommendation.agents.map((a) => a.slug);
  const pricing = computeTeamPricing(selected);

  const rows = await withOrg(organizationId, (tx) =>
    tx.select().from(agentInstance),
  );

  return {
    state,
    answers,
    recommendation,
    pricing,
    instances: rows.map((r) => ({
      id: r.id,
      slug: r.definitionSlug,
      displayName: r.displayName,
      status: r.status,
      sandboxPassed: r.sandboxPassedAt !== null,
    })),
  };
}
