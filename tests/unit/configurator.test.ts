import { describe, expect, it } from "vitest";
import {
  computeRecommendation,
  configuratorAnswersSchema,
} from "@/server/configurator/logic";

const baseAnswers = configuratorAnswersSchema.parse({});

describe("Team-Konfigurator — Empfehlungslogik", () => {
  it("liefert ohne Angaben ein Starter-Team", () => {
    const rec = computeRecommendation(baseAnswers);
    const slugs = rec.agents.map((a) => a.slug);
    expect(slugs).toContain("email-triage");
    expect(slugs).toContain("task");
    expect(slugs).toContain("company-memory");
  });

  it("mappt Zeitfresser auf passende Agenten mit Begründung", () => {
    const rec = computeRecommendation({
      ...baseAnswers,
      zeitfresser: ["rechnungen"],
    });
    const invoice = rec.agents.find((a) => a.slug === "invoice-intake");
    expect(invoice).toBeDefined();
    expect(invoice!.reasons[0]).toMatch(/Beleg|Rechnungs/);
  });

  it("empfiehlt den Chief of Staff ab 4 Agenten", () => {
    const rec = computeRecommendation({
      ...baseAnswers,
      zeitfresser: ["email", "termine", "followups"],
    });
    expect(rec.agents.map((a) => a.slug)).toContain("chief-of-staff");
    // Chief of Staff steht in der Implementierungsreihenfolge am Ende
    expect(rec.implementationOrder.at(-1)).toBe("chief-of-staff");
  });

  it("Umsatzverluste erzeugen Sales-Empfehlungen", () => {
    const rec = computeRecommendation({
      ...baseAnswers,
      umsatzverluste: ["keine-followups"],
    });
    expect(rec.agents.map((a) => a.slug)).toContain("follow-up");
  });

  it("hohe Datenschutzanforderungen erzeugen einen Hinweis", () => {
    const rec = computeRecommendation({
      ...baseAnswers,
      datenschutz: "hoch",
    });
    expect(rec.privacyNote).toMatch(/Auftragsverarbeitung/);
    expect(
      computeRecommendation({ ...baseAnswers, datenschutz: "standard" })
        .privacyNote,
    ).toBeNull();
  });

  it("aggregiert benötigte Integrationen ohne Duplikate", () => {
    const rec = computeRecommendation({
      ...baseAnswers,
      zeitfresser: ["email", "followups"],
    });
    const unique = new Set(rec.requiredIntegrations);
    expect(unique.size).toBe(rec.requiredIntegrations.length);
    expect(rec.requiredIntegrations).toContain("email");
  });

  it("Zeitersparnis ist eine positive, konservative Schätzung", () => {
    const rec = computeRecommendation({
      ...baseAnswers,
      zeitfresser: ["email"],
    });
    expect(rec.totalEstimatedHoursSaved).toBeGreaterThan(0);
    expect(rec.totalEstimatedHoursSaved).toBeLessThan(200);
  });
});
