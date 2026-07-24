import { describe, expect, it } from "vitest";
import { computeTeamPricing } from "@/server/billing/pricing";
import { getAgentsByDepartment, departments } from "@/server/agents/catalog";

describe("Pricing-Engine (serverseitig)", () => {
  it("leere Auswahl kostet nichts", () => {
    const p = computeTeamPricing([]);
    expect(p.totalMonthlyCents).toBe(0);
    expect(p.items).toHaveLength(0);
    expect(p.bundles).toHaveLength(0);
  });

  it("einzelne Agenten werden nach Preisstufe berechnet", () => {
    const p = computeTeamPricing(["task", "email-triage"]);
    // task = simple (149 €), email-triage = advanced (349 €)
    expect(p.totalMonthlyCents).toBe(14900 + 34900);
    expect(p.volumeDiscountCents).toBe(0);
  });

  it("unbekannte Slugs werden ignoriert", () => {
    const p = computeTeamPricing(["task", "gibt-es-nicht"]);
    expect(p.items).toHaveLength(1);
  });

  it("Duplikate zählen nur einmal", () => {
    const p = computeTeamPricing(["task", "task"]);
    expect(p.items).toHaveLength(1);
  });

  it("ab 5 Einzel-Agenten gibt es 10 % Mengenrabatt", () => {
    const p = computeTeamPricing([
      "task",
      "email-triage",
      "calendar",
      "crm-agent",
      "reminder",
    ]);
    expect(p.volumeDiscountPercent).toBe(10);
    expect(p.volumeDiscountCents).toBeGreaterThan(0);
  });

  it("ein komplettes Department wird zum Paketpreis abgerechnet", () => {
    const officeAgents = getAgentsByDepartment("office").map((a) => a.slug);
    const p = computeTeamPricing(officeAgents);
    expect(p.bundles).toHaveLength(1);
    expect(p.bundles[0]!.department).toBe("office");
    expect(p.items).toHaveLength(0);
    expect(p.totalMonthlyCents).toBe(departments.office.bundlePriceCents);
    // Paket muss günstiger sein als Einzelsumme
    expect(p.bundles[0]!.bundleCents).toBeLessThan(
      p.bundles[0]!.individualSumCents,
    );
    expect(p.bundleSavingsCents).toBeGreaterThan(0);
  });

  it("Paket + Einzelagenten kombinieren korrekt", () => {
    const officeAgents = getAgentsByDepartment("office").map((a) => a.slug);
    const p = computeTeamPricing([...officeAgents, "chief-of-staff"]);
    expect(p.bundles).toHaveLength(1);
    expect(p.items).toHaveLength(1);
    expect(p.totalMonthlyCents).toBe(
      departments.office.bundlePriceCents! + 99900,
    );
  });
});
