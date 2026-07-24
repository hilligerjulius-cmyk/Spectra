import { z } from "zod";
import {
  agentCatalog,
  departments,
  getAgentDefinition,
  type AgentDefinitionData,
  type DepartmentSlug,
} from "@/server/agents/catalog";

/**
 * Regelbasierte Empfehlungslogik des Team-Konfigurators.
 * Läuft ausschließlich serverseitig; der Client erhält nur Ergebnisse.
 * Zeitersparnis-Werte sind bewusst konservative Schätzungen und werden im UI
 * ausdrücklich als unverbindlich gekennzeichnet.
 */

export const configuratorAnswersSchema = z.object({
  branche: z.string().max(60).default(""),
  unternehmensgroesse: z
    .enum(["1-4", "5-25", "26-100", "101-250", ""])
    .default(""),
  software: z.array(z.string().max(40)).max(30).default([]),
  zeitfresser: z.array(z.string().max(40)).max(20).default([]),
  umsatzverluste: z.array(z.string().max(40)).max(20).default([]),
  departments: z.array(z.string().max(40)).max(10).default([]),
  automatisierungsgrad: z
    .enum(["beobachten", "entwurf", "freigabe", "autonom", ""])
    .default(""),
  vorgaenge: z.enum(["<100", "100-500", "500-2000", ">2000", ""]).default(""),
  datenschutz: z.enum(["standard", "hoch", ""]).default(""),
});

export type ConfiguratorAnswers = z.infer<typeof configuratorAnswersSchema>;

interface RecommendationRule {
  reason: string;
  slugs: string[];
}

const zeitfresserRules: Record<string, RecommendationRule> = {
  email: {
    reason: "Sie verlieren Zeit im Posteingang",
    slugs: ["email-triage", "email-draft"],
  },
  termine: {
    reason: "Terminkoordination frisst Arbeitszeit",
    slugs: ["calendar", "meeting-preparation"],
  },
  followups: {
    reason: "Follow-ups bleiben liegen",
    slugs: ["follow-up", "crm-agent"],
  },
  angebote: {
    reason: "Angebotserstellung dauert zu lange",
    slugs: ["proposal", "follow-up"],
  },
  rechnungen: {
    reason: "Rechnungs- und Belegverarbeitung ist manuell",
    slugs: ["invoice-intake", "receipt", "expense"],
  },
  support: {
    reason: "Supportanfragen binden Ihr Team",
    slugs: ["customer-inquiry", "ticket-routing", "knowledge-base"],
  },
  wissen: {
    reason: "Wissen ist verstreut und schwer auffindbar",
    slugs: ["company-memory", "document-intelligence", "knowledge-search"],
  },
  fristen: {
    reason: "Fristen und Pflichten werden knapp",
    slugs: ["deadline", "reminder"],
  },
  projekte: {
    reason: "Projektstatus einzusammeln kostet Zeit",
    slugs: ["project-status", "task-monitoring"],
  },
  hr: {
    reason: "Administrative Personalarbeit belastet",
    slugs: ["applicant-administration", "onboarding", "leave-administration"],
  },
};

const umsatzRules: Record<string, RecommendationRule> = {
  "liegengebliebene-leads": {
    reason: "Eingehende Leads werden nicht schnell genug bearbeitet",
    slugs: ["lead-qualification", "follow-up"],
  },
  "langsame-angebote": {
    reason: "Angebote gehen zu spät raus",
    slugs: ["proposal"],
  },
  "keine-followups": {
    reason: "Offene Angebote werden nicht nachverfolgt",
    slugs: ["follow-up", "sales-reporting"],
  },
  churn: {
    reason: "Bestandskunden wandern unbemerkt ab",
    slugs: ["customer-recovery", "review"],
  },
  "keine-leads": {
    reason: "Es fehlt an qualifizierten Zielkunden",
    slugs: ["lead-research", "outreach-draft"],
  },
};

/** Kern-Agenten je Department für die Department-Vorauswahl. */
const departmentCoreAgents: Record<string, string[]> = {
  sales: ["lead-qualification", "follow-up", "meeting-preparation", "sales-reporting"],
  office: ["email-triage", "email-draft", "calendar", "task"],
  finance: ["invoice-intake", "payment-monitoring", "expense"],
  hr: ["applicant-administration", "onboarding", "leave-administration"],
  "customer-service": ["customer-inquiry", "ticket-routing", "escalation"],
  operations: ["task-monitoring", "deadline", "project-status"],
  knowledge: ["company-memory", "document-intelligence", "knowledge-search"],
};

/**
 * Konservative Zeitersparnis-Schätzung in Stunden/Monat je Preisstufe.
 * Dokumentierte Annahme — im UI klar als unverbindliche Schätzung markiert.
 */
const estimatedHoursSavedPerMonth: Record<string, number> = {
  simple: 5,
  advanced: 10,
  complex: 16,
  chief: 12,
};

export interface RecommendedAgent {
  slug: string;
  personaName: string;
  roleTitle: string;
  department: DepartmentSlug;
  departmentName: string;
  reasons: string[];
  requiredIntegrations: string[];
  setupEffort: AgentDefinitionData["setupEffort"];
  priceTier: AgentDefinitionData["priceTier"];
  estimatedHoursSavedPerMonth: number;
}

export interface ConfiguratorRecommendation {
  agents: RecommendedAgent[];
  requiredIntegrations: string[];
  totalEstimatedHoursSaved: number;
  implementationOrder: string[];
  setupEffortSummary: "low" | "medium" | "high";
  privacyNote: string | null;
}

const setupRank = { low: 0, medium: 1, high: 2 } as const;
const tierRank = { simple: 0, advanced: 1, complex: 2, chief: 3 } as const;

export function computeRecommendation(
  answers: ConfiguratorAnswers,
): ConfiguratorRecommendation {
  const reasonsBySlug = new Map<string, Set<string>>();

  function add(slugs: string[], reason: string) {
    for (const slug of slugs) {
      if (!getAgentDefinition(slug)) continue;
      const set = reasonsBySlug.get(slug) ?? new Set<string>();
      set.add(reason);
      reasonsBySlug.set(slug, set);
    }
  }

  for (const key of answers.zeitfresser) {
    const rule = zeitfresserRules[key];
    if (rule) add(rule.slugs, rule.reason);
  }
  for (const key of answers.umsatzverluste) {
    const rule = umsatzRules[key];
    if (rule) add(rule.slugs, rule.reason);
  }
  for (const dept of answers.departments) {
    const core = departmentCoreAgents[dept];
    const deptDef = departments[dept as DepartmentSlug];
    if (core && deptDef) {
      add(core, `Kernrollen des gewünschten Departments ${deptDef.shortName}`);
    }
  }

  // Fallback: ohne konkrete Angaben ein sinnvolles Starter-Team
  if (reasonsBySlug.size === 0) {
    add(
      ["email-triage", "task", "company-memory"],
      "Bewährtes Starter-Team für den Einstieg",
    );
  }

  // Chief of Staff ab 4 Agenten empfehlen
  if (reasonsBySlug.size >= 4) {
    add(
      ["chief-of-staff"],
      "Koordiniert Ihr digitales Team, bündelt Freigaben und erstellt Briefings",
    );
  }

  const agents: RecommendedAgent[] = [...reasonsBySlug.entries()].map(
    ([slug, reasons]) => {
      const def = getAgentDefinition(slug)!;
      return {
        slug,
        personaName: def.personaName,
        roleTitle: def.roleTitle,
        department: def.department,
        departmentName: departments[def.department].shortName,
        reasons: [...reasons],
        requiredIntegrations: def.requiredIntegrations,
        setupEffort: def.setupEffort,
        priceTier: def.priceTier,
        estimatedHoursSavedPerMonth:
          estimatedHoursSavedPerMonth[def.priceTier] ?? 5,
      };
    },
  );

  // Implementierungsreihenfolge: geringer Aufwand und einfache Agenten zuerst,
  // Chief of Staff zum Schluss (koordiniert, sobald das Team steht).
  const ordered = [...agents].sort((a, b) => {
    if (a.slug === "chief-of-staff") return 1;
    if (b.slug === "chief-of-staff") return -1;
    return (
      setupRank[a.setupEffort] - setupRank[b.setupEffort] ||
      tierRank[a.priceTier] - tierRank[b.priceTier]
    );
  });

  const requiredIntegrations = [
    ...new Set(agents.flatMap((a) => a.requiredIntegrations)),
  ];

  const maxEffort = agents.reduce<"low" | "medium" | "high">((acc, a) => {
    return setupRank[a.setupEffort] > setupRank[acc] ? a.setupEffort : acc;
  }, "low");

  return {
    agents: ordered,
    requiredIntegrations,
    totalEstimatedHoursSaved: agents.reduce(
      (sum, a) => sum + a.estimatedHoursSavedPerMonth,
      0,
    ),
    implementationOrder: ordered.map((a) => a.slug),
    setupEffortSummary: maxEffort,
    privacyNote:
      answers.datenschutz === "hoch"
        ? "Bei erhöhten Datenschutzanforderungen empfehlen wir: Automatisierungsstufen zunächst auf 'Entwurf' oder 'Freigabe erforderlich', restriktive Datenquellen-Freigaben und Abschluss eines Auftragsverarbeitungsvertrags."
        : null,
  };
}

/** Alle Katalog-Slugs (für Validierung von Nutzer-Overrides). */
export const allCatalogSlugs = new Set(agentCatalog.map((a) => a.slug));
