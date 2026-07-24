import { describe, expect, it } from "vitest";
import {
  agentCatalog,
  departments,
  getAgentDefinition,
  getAgentsByDepartment,
} from "@/server/agents/catalog";

describe("Agentenkatalog", () => {
  it("enthält 57 Agenten (7 Departments × 8 + Chief of Staff)", () => {
    expect(agentCatalog).toHaveLength(57);
  });

  it("hat 8 Agenten in jedem der 7 Fach-Departments und 1 in Leadership", () => {
    expect(getAgentsByDepartment("leadership")).toHaveLength(1);
    for (const dept of [
      "sales",
      "office",
      "finance",
      "hr",
      "customer-service",
      "operations",
      "knowledge",
    ] as const) {
      expect(getAgentsByDepartment(dept), dept).toHaveLength(8);
    }
  });

  it("hat eindeutige Slugs und Persona-Namen", () => {
    const slugs = agentCatalog.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const personas = agentCatalog.map((a) => a.personaName);
    expect(new Set(personas).size).toBe(personas.length);
  });

  it("jede Definition ist vollständig und konsistent", () => {
    for (const agent of agentCatalog) {
      expect(agent.capabilities.length, agent.slug).toBeGreaterThan(0);
      expect(agent.kpis.length, agent.slug).toBeGreaterThan(0);
      expect(agent.boundaries.length, agent.slug).toBeGreaterThan(0);
      expect(agent.responsibilities.length, agent.slug).toBeGreaterThan(0);
      expect(agent.systemPrompt.length, agent.slug).toBeGreaterThan(100);
      expect(departments[agent.department], agent.slug).toBeDefined();
      for (const cap of agent.capabilities) {
        expect(
          cap.defaultAutomationLevel,
          `${agent.slug}/${cap.key}`,
        ).toBeLessThanOrEqual(cap.maxAutomationLevel);
        expect(cap.requiredTools.length, `${agent.slug}/${cap.key}`).toBeGreaterThan(0);
        // Hochriskante Fähigkeiten dürfen nie über Stufe 4 hinaus und
        // starten nie autonom.
        if (cap.riskLevel === "high") {
          expect(cap.defaultAutomationLevel, `${agent.slug}/${cap.key}`).toBeLessThanOrEqual(3);
        }
      }
      // Capability-Keys je Agent eindeutig
      const keys = agent.capabilities.map((c) => c.key);
      expect(new Set(keys).size, agent.slug).toBe(keys.length);
    }
  });

  it("kennt die vertieft implementierten Agenten", () => {
    const deep = agentCatalog
      .filter((a) => a.implementationDepth === "deep")
      .map((a) => a.slug)
      .sort();
    expect(deep).toEqual([
      "chief-of-staff",
      "company-memory",
      "email-triage",
      "follow-up",
      "invoice-intake",
      "meeting-preparation",
      "task",
    ]);
  });

  it("Lookup per Slug funktioniert", () => {
    expect(getAgentDefinition("email-triage")?.personaName).toBe("Nora");
    expect(getAgentDefinition("nicht-vorhanden")).toBeUndefined();
  });
});
