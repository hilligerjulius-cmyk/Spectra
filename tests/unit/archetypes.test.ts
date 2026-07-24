import { describe, expect, it } from "vitest";
import { agentCatalog } from "@/server/agents/catalog";
import {
  classifyCapability,
  type CapabilityArchetype,
} from "@/server/agents/runtime/archetypes";
import { ARCHETYPE_HANDLERS } from "@/server/agents/runtime/handlers-generic";

/**
 * Der Katalog wächst; die Archetyp-Zuordnung muss mitwachsen. Diese Tests
 * halten fest, dass jede Fähigkeit einen Handler bekommt und dass die
 * Zuordnung fachlich plausibel bleibt.
 */

const allCapabilityKeys = [
  ...new Set(agentCatalog.flatMap((a) => a.capabilities.map((c) => c.key))),
];

describe("Fähigkeits-Archetypen", () => {
  it("ordnet jeder Katalogfähigkeit einen implementierten Handler zu", () => {
    for (const key of allCapabilityKeys) {
      const archetype = classifyCapability(key);
      expect(
        ARCHETYPE_HANDLERS[archetype],
        `Kein Handler für Archetyp "${archetype}" (Fähigkeit "${key}")`,
      ).toBeTypeOf("function");
    }
  });

  it("nutzt die Rückfallebene 'analysis' für keine einzige Fähigkeit", () => {
    // Ein Treffer hier bedeutet: Der Katalog hat eine Fähigkeit bekommen,
    // deren Absicht die Muster nicht erfassen — dann gehört sie in
    // archetypes.ts ergänzt statt unbemerkt generisch zu laufen.
    const fallback = allCapabilityKeys.filter(
      (k) => classifyCapability(k) === "analysis",
    );
    expect(fallback).toEqual([]);
  });

  it("ordnet bekannte Fähigkeiten fachlich korrekt zu", () => {
    const expected: Record<string, CapabilityArchetype> = {
      "invoice-extraction": "extract",
      "deadline-extraction": "extract",
      "field-check": "extract",
      "ticket-classification": "classify",
      "escalation-routing": "classify",
      "lead-scoring": "classify",
      prioritize: "classify",
      "followup-drafting": "draft",
      "proposal-drafting": "draft",
      "coaching-suggestions": "draft",
      "daily-briefing": "summarize",
      "case-summary": "summarize",
      "funnel-reporting": "report",
      "open-item-report": "report",
      "qa-with-sources": "qa",
      "semantic-search": "qa",
      "task-creation": "checklist",
      "checklist-creation": "checklist",
      "risk-watch": "monitor",
      "churn-detection": "monitor",
      "trend-analysis": "monitor",
    };
    for (const [key, archetype] of Object.entries(expected)) {
      expect(classifyCapability(key), `Fähigkeit "${key}"`).toBe(archetype);
    }
  });

  it("nutzt alle acht Archetypen tatsächlich im Katalog", () => {
    const used = new Set(allCapabilityKeys.map(classifyCapability));
    for (const archetype of [
      "monitor",
      "classify",
      "extract",
      "draft",
      "summarize",
      "report",
      "checklist",
      "qa",
    ] as const) {
      expect(used.has(archetype), `Archetyp "${archetype}" ungenutzt`).toBe(
        true,
      );
    }
  });

  it("ist deterministisch", () => {
    for (const key of allCapabilityKeys) {
      expect(classifyCapability(key)).toBe(classifyCapability(key));
    }
  });
});
