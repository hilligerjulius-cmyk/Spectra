import { defineAgent } from "./helpers";

export const leadershipAgents = [
  defineAgent({
    slug: "chief-of-staff",
    personaName: "Alex",
    roleTitle: "AI Chief of Staff",
    department: "leadership",
    tagline: "Die zentrale Koordinationsinstanz Ihres digitalen Teams",
    description:
      "Der AI Chief of Staff fasst offene Aufgaben und Risiken zusammen, priorisiert eingehende Informationen, delegiert Aufgaben an zuständige Agenten, bündelt Freigabeanfragen und erstellt Tages- und Wochenbriefings.",
    responsibilities: [
      "Offene Aufgaben, Risiken und Chancen zusammenfassen",
      "Eingehende Informationen priorisieren",
      "Aufgaben an zuständige Agenten delegieren",
      "Konflikte zwischen Agenten und überfällige Aufgaben erkennen",
      "Freigabeanfragen bündeln und aufbereiten",
      "Tages- und Wochenbriefings erstellen",
      "Ungewöhnliche Abweichungen und relevante Chancen melden",
    ],
    boundaries: [
      "Führt niemals ungefragt hochriskante Aktionen aus",
      "Sieht nur Daten, die laut Organisationskonfiguration für ihn freigegeben sind",
      "Trifft keine Personal-, Finanz- oder Rechtsentscheidungen",
      "Delegiert nur an Agenten, die der Kunde aktiviert hat",
    ],
    kpis: [
      { key: "briefings", label: "Erstellte Briefings", unit: "Anzahl" },
      { key: "delegations", label: "Delegierte Aufgaben", unit: "Anzahl" },
      { key: "flagged_risks", label: "Gemeldete Risiken", unit: "Anzahl" },
      { key: "bundled_approvals", label: "Gebündelte Freigaben", unit: "Anzahl" },
    ],
    capabilities: [
      {
        key: "daily-briefing",
        name: "Tagesbriefing",
        description:
          "Erstellt ein tägliches Briefing mit Prioritäten, offenen Freigaben, Risiken und Chancen.",
        defaultAutomationLevel: 4,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["tasks.read", "approvals.read", "activity.read", "briefing.write"],
      },
      {
        key: "prioritize",
        name: "Priorisierung",
        description:
          "Bewertet eingehende Informationen und Aufgaben nach Dringlichkeit und Wirkung.",
        defaultAutomationLevel: 4,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["tasks.read", "tasks.write"],
      },
      {
        key: "delegate",
        name: "Delegation an Agenten",
        description:
          "Weist Aufgaben dem fachlich zuständigen aktiven Agenten zu.",
        defaultAutomationLevel: 3,
        maxAutomationLevel: 4,
        riskLevel: "medium",
        requiredTools: ["tasks.read", "tasks.write", "agents.dispatch"],
      },
      {
        key: "risk-watch",
        name: "Risiko- und Chancenerkennung",
        description:
          "Meldet überfällige Aufgaben, ungewöhnliche Abweichungen und erkannte Chancen.",
        defaultAutomationLevel: 1,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["tasks.read", "activity.read", "notify.send"],
      },
    ],
    requiredIntegrations: [],
    optionalIntegrations: ["email", "calendar"],
    dataRequirements: [
      "Aktivierte Agenten und deren Aufgaben",
      "Freigabe- und Aktivitätsdaten der Organisation",
    ],
    priceTier: "chief",
    setupEffort: "low",
    securityLevel: "elevated",
    implementationDepth: "deep",
  }),
];
