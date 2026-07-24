/**
 * Typmodell des Agentenkatalogs. Der Katalog ist Code (typisiert, versioniert,
 * getestet); organisationsspezifische Konfiguration (Automatisierungsstufen,
 * Berechtigungen, Preise-Overrides) liegt in der Datenbank.
 */

export type DepartmentSlug =
  | "leadership"
  | "sales"
  | "office"
  | "finance"
  | "hr"
  | "customer-service"
  | "operations"
  | "knowledge";

export type AutomationLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const AUTOMATION_LEVELS: Record<
  AutomationLevel,
  { name: string; description: string }
> = {
  0: { name: "Ausgeschaltet", description: "Der Agent führt keine Aufgaben aus." },
  1: {
    name: "Beobachten",
    description:
      "Der Agent analysiert Daten und meldet Auffälligkeiten, führt jedoch keine Aktion aus.",
  },
  2: { name: "Entwurf", description: "Der Agent erstellt Vorschläge oder Entwürfe." },
  3: {
    name: "Freigabe erforderlich",
    description:
      "Der Agent bereitet die Aktion vollständig vor, führt sie aber erst nach menschlicher Freigabe aus.",
  },
  4: {
    name: "Autonom innerhalb von Regeln",
    description:
      "Der Agent darf klar definierte risikoarme Aktionen selbst ausführen.",
  },
  5: {
    name: "Erweiterte Autonomie",
    description:
      "Nur für ausdrücklich erlaubte, getestete und reversible Aktionen.",
  },
};

export type RiskLevel = "low" | "medium" | "high";
export type PriceTier = "simple" | "advanced" | "complex" | "chief";
export type SetupEffort = "low" | "medium" | "high";

/** Standard-Monatspreise je Stufe in Cent (admin-seitig überschreibbar, Spec §16). */
export const DEFAULT_TIER_PRICES_CENTS: Record<PriceTier, number> = {
  simple: 14900,
  advanced: 34900,
  complex: 69900,
  chief: 99900,
};

export interface AgentCapabilityDef {
  key: string;
  name: string;
  description: string;
  /** Empfohlene Startstufe. */
  defaultAutomationLevel: AutomationLevel;
  /** Sicherheitsobergrenze — kann auch vom Nutzer nicht überschritten werden. */
  maxAutomationLevel: AutomationLevel;
  riskLevel: RiskLevel;
  /** Tool-Schlüssel, die diese Fähigkeit benötigt (Runtime-Berechtigungen). */
  requiredTools: string[];
}

export interface AgentKpiDef {
  key: string;
  label: string;
  unit: string;
}

export interface AgentDefinitionData {
  /** Stabiler Katalog-Schlüssel, z. B. "email-triage". */
  slug: string;
  /** Standard-"Mitarbeitername" (vom Kunden umbenennbar). */
  personaName: string;
  roleTitle: string;
  department: DepartmentSlug;
  tagline: string;
  /** Stellenbeschreibung. */
  description: string;
  responsibilities: string[];
  boundaries: string[];
  kpis: AgentKpiDef[];
  capabilities: AgentCapabilityDef[];
  /** Connector-Keys, ohne die der Agent nicht sinnvoll arbeitet. */
  requiredIntegrations: string[];
  optionalIntegrations: string[];
  dataRequirements: string[];
  priceTier: PriceTier;
  setupEffort: SetupEffort;
  securityLevel: "standard" | "elevated";
  /** Systemanweisung für die Runtime. */
  systemPrompt: string;
  typicalTasks: string[];
  workflow: string[];
  faq: { q: string; a: string }[];
  /** Akzentfarbe des Avatars (Tailwind-Klasse). */
  avatarColor: string;
  /**
   * Ehrlichkeits-Marker: "deep" = vertieft implementierte, getestete Logik;
   * "standard" = läuft real über die generischen Capability-Handler der Runtime.
   */
  implementationDepth: "deep" | "standard";
}

export interface DepartmentDefinition {
  slug: DepartmentSlug;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  /** Monatspreis des Department-Pakets in Cent (admin-seitig überschreibbar). */
  bundlePriceCents: number | null;
  disclaimer?: string;
}
