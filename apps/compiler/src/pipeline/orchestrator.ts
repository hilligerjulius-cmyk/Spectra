import type {
  AppManifest,
  MaterializeRequest,
  MaterializeResult,
  PhaseEvent,
  PhaseName,
  PhaseStatus,
  GenerationStrategy,
} from "@spectra/contracts";
import { base, text as textTokens } from "@spectra/design-tokens";
import type { Config } from "../config";
import type { Emit } from "./types";
import { ingestIntent, archetypeLabel } from "../generators/deterministic/intent-grammar";
import {
  selectGenerator,
  deterministicGenerator,
  deterministicFallback,
  type Generator,
  type GenerationRequest,
} from "../generators";
import { validateSource } from "./stages/validate";
import { compileSource } from "./stages/compile";
import { contentHash } from "../util/hash";
import { materializeCache, cacheKey } from "../cache/store";
import { log } from "../util/logger";

const PROGRESS: Record<PhaseName, number> = {
  ingest: 0.12,
  generate: 0.38,
  validate: 0.58,
  compile: 0.82,
  repair: 0.7,
  package: 0.95,
};

function mkPhase(
  phase: PhaseName,
  status: PhaseStatus,
  label: string,
  detail?: string,
): PhaseEvent {
  return { kind: "phase", phase, status, label, progress: PROGRESS[phase], detail, at: Date.now() };
}

/**
 * Run the full compilation pipeline for one intent, streaming phase events as
 * it goes. Guarantees a mountable result: if generation/validation/compilation
 * cannot be healed within the repair budget, it falls back to a deterministic
 * template that is valid by construction.
 */
export async function materialize(
  request: MaterializeRequest,
  config: Config,
  emit: Emit,
  generatorOverride?: Generator,
): Promise<MaterializeResult> {
  const started = Date.now();

  // ── 1. Ingest ──
  emit(mkPhase("ingest", "start", "Reading intent"));
  const ing = ingestIntent(request.intent);
  emit(mkPhase("ingest", "ok", "Classified as " + archetypeLabel(ing.archetype), ing.archetype));

  // Generator resolution (explicit override → forced deterministic → model pick).
  const requestedStrategy = request.options?.strategy ?? "auto";
  let generator: Generator;
  if (generatorOverride) generator = generatorOverride;
  else if (requestedStrategy === "deterministic") generator = deterministicGenerator;
  else generator = selectGenerator(config, request.options?.model);

  const req: GenerationRequest = { intent: request.intent, archetype: ing.archetype, params: ing.params };
  const key = cacheKey(ing.normalized, generator.modelId ?? "deterministic");

  // ── Cache ──
  if (!request.options?.noCache) {
    const hit = materializeCache.get(key);
    if (hit) {
      emit(mkPhase("generate", "ok", "Recalled from cache", "cache"));
      emit(mkPhase("package", "ok", "Ready"));
      const cached: MaterializeResult = { ...hit, cached: true };
      emit({ kind: "done", result: cached, at: Date.now() });
      return cached;
    }
  }

  // ── 2. Generate ──
  emit(
    mkPhase(
      "generate",
      "start",
      generator.kind === "llm" ? "Generating with model" : "Composing from archetype",
      generator.modelId ?? undefined,
    ),
  );
  let source: string;
  let strategy: GenerationStrategy;
  try {
    const gen = await generator.generate(req);
    source = gen.source;
    strategy = gen.strategy;
    emit(mkPhase("generate", "ok", "Candidate drafted", generator.modelId ?? generator.kind));
  } catch (err) {
    // The model call itself failed (bad key, rate limit, network) — fall back
    // to a guaranteed template rather than erroring out.
    emit(mkPhase("generate", "warn", "Model unavailable — using template", (err as Error).message));
    source = deterministicFallback(req);
    strategy = "repair-fallback";
  }

  // ── 3-5. Validate → Compile → Repair loop ──
  let bundle: string | undefined;
  let attempt = 0;

  while (bundle === undefined) {
    let errors: readonly string[];
    emit(mkPhase("validate", "start", "Validating syntax tree"));
    const validation = validateSource(source);

    if (validation.ok) {
      emit(mkPhase("validate", "ok", "Contract & policy satisfied"));
      emit(mkPhase("compile", "start", "Compiling to module"));
      const compiled = await compileSource(source);
      if (compiled.ok && compiled.bundle) {
        emit(mkPhase("compile", "ok", "Zero syntax errors"));
        bundle = compiled.bundle;
        break;
      }
      emit(mkPhase("compile", "warn", "Compilation issue", compiled.errors[0]));
      errors = compiled.errors;
    } else {
      emit(mkPhase("validate", "warn", "Policy/contract issue", validation.errors[0]));
      errors = validation.errors;
    }

    // Need to heal.
    if (attempt >= config.maxRepairAttempts) {
      emit(mkPhase("repair", "warn", "Falling back to guaranteed template", "fallback"));
      source = deterministicFallback(req);
      strategy = "repair-fallback";
      const fb = await compileSource(source);
      if (!fb.ok || !fb.bundle) {
        throw new Error("Fallback template failed to compile: " + fb.errors.join("; "));
      }
      bundle = fb.bundle;
      break;
    }

    attempt += 1;
    emit(mkPhase("repair", "start", "Repairing (attempt " + attempt + ")", String(attempt)));
    try {
      const repaired = await generator.repair(req, source, errors);
      source = repaired.source;
      strategy = repaired.strategy;
    } catch (err) {
      // Repair call failed — heal with a guaranteed template immediately.
      emit(mkPhase("repair", "warn", "Model unavailable — using template", (err as Error).message));
      source = deterministicFallback(req);
      strategy = "repair-fallback";
      const fb = await compileSource(source);
      if (!fb.ok || !fb.bundle) {
        throw new Error("Fallback template failed to compile: " + fb.errors.join("; "));
      }
      bundle = fb.bundle;
      break;
    }
  }

  // ── 6. Package ──
  emit(mkPhase("package", "start", "Packaging module"));
  const hash = contentHash(bundle);
  const manifest: AppManifest = {
    id: hash,
    name: ing.title,
    description: request.intent.trim(),
    archetype: ing.archetype,
    props: [],
    tokens: { accent: ing.params.accent, surface: base.surface, text: textTokens.primary },
    hash,
    strategy,
    model: strategy === "deterministic" || strategy === "repair-fallback" ? null : generator.modelId,
    elapsedMs: Date.now() - started,
    createdAt: new Date().toISOString(),
  };
  const result: MaterializeResult = { manifest, bundle, cached: false };
  materializeCache.set(key, result);
  emit(mkPhase("package", "ok", "Ready"));
  emit({ kind: "done", result, at: Date.now() });

  log.info("materialized", { archetype: ing.archetype, strategy, ms: manifest.elapsedMs, hash });
  return result;
}
