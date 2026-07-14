import { describe, it, expect } from "vitest";
import type { PhaseEvent, MaterializeResult } from "@spectra/contracts";
import type { Config } from "../src/config";
import type { Generator } from "../src/generators";
import { materialize } from "../src/pipeline/orchestrator";

const config: Config = {
  port: 4000,
  host: "0.0.0.0",
  anthropic: { apiKey: undefined },
  providers: [],
  availableModels: [],
  defaultModel: null,
  llmEnabled: false,
  maxRepairAttempts: 2,
};

async function run(intent: string, noCache = true) {
  const events: PhaseEvent[] = [];
  const result = await materialize({ intent, options: { noCache } }, config, (e) => events.push(e));
  return { events, result };
}

describe("materialize pipeline", () => {
  it("streams ordered phases and produces a mountable bundle", async () => {
    const { events, result } = await run("a kanban board");

    const phases = events.filter((e) => e.kind === "phase").map((e) => (e as { phase: string }).phase);
    expect(phases).toContain("ingest");
    expect(phases).toContain("generate");
    expect(phases).toContain("validate");
    expect(phases).toContain("compile");
    expect(phases).toContain("package");

    const done = events.find((e) => e.kind === "done") as Extract<PhaseEvent, { kind: "done" }>;
    expect(done).toBeDefined();
    expect(done.result.manifest.archetype).toBe("kanban");
    expect(done.result.bundle.length).toBeGreaterThan(0);
    expect(result.manifest.strategy).toBe("deterministic");
  });

  it("classifies varied intents to the right archetype", async () => {
    const cases: Array<[string, string]> = [
      ["a pomodoro timer", "timer"],
      ["contact form for my site", "form"],
      ["show me pricing plans", "pricing"],
      ["a markdown notepad", "notes"],
      ["some totally novel thing", "landing"],
    ];
    for (const [intent, expected] of cases) {
      const { result } = await run(intent);
      expect(result.manifest.archetype, intent).toBe(expected);
    }
  });

  it("serves a repeated intent from cache", async () => {
    await run("a habit tracker", false);
    const { result } = await run("a habit tracker", false);
    expect(result.cached).toBe(true);
  });

  it("falls back to a valid template when generation cannot be healed", async () => {
    const broken: Generator = {
      kind: "llm",
      strategy: "anthropic",
      modelId: "test-model",
      async generate() {
        return { source: "this is <<< not valid tsx !!!", strategy: "anthropic" };
      },
      async repair() {
        return { source: "still ::: broken )))", strategy: "anthropic" };
      },
    };
    const events: PhaseEvent[] = [];
    const result = await materialize(
      { intent: "a dashboard", options: { noCache: true } },
      config,
      (e) => events.push(e),
      broken,
    );
    expect(result.manifest.strategy).toBe("repair-fallback");
    expect(result.bundle.length).toBeGreaterThan(0);
    expect(result.manifest.archetype).toBe("dashboard");
  });

  it("falls back to a template when the model API call throws", async () => {
    const throwing: Generator = {
      kind: "llm",
      strategy: "anthropic",
      modelId: "test-model",
      async generate() {
        throw new Error("401 Unauthorized (bad key)");
      },
      async repair() {
        throw new Error("401 Unauthorized (bad key)");
      },
    };
    const result = await materialize(
      { intent: "a pricing page", options: { noCache: true } },
      config,
      () => {},
      throwing,
    );
    expect(result.manifest.strategy).toBe("repair-fallback");
    expect(result.manifest.model).toBeNull();
    expect(result.bundle.length).toBeGreaterThan(0);
    expect(result.manifest.archetype).toBe("pricing");
  });
});
