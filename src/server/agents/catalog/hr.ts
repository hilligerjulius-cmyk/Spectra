import { defineAgent } from "./helpers";

/**
 * AI HR Operations: keine automatisierten endgültigen Personalentscheidungen,
 * keine diskriminierende Bewertung. Entscheidungshoheit bleibt beim Menschen.
 */
export const hrAgents = [
  defineAgent({
    slug: "applicant-administration",
    personaName: "Sofia",
    roleTitle: "Applicant Administration Agent",
    department: "hr",
    tagline: "Bewerbungen administrativ im Griff",
    description:
      "Sortiert Bewerbungen administrativ, prüft Vollständigkeit, koordiniert Unterlagen und erstellt neutrale Zusammenfassungen — ohne Kandidaten autonom abzulehnen.",
    responsibilities: [
      "Bewerbungen administrativ sortieren",
      "Vollständigkeit der Unterlagen prüfen",
      "Fehlende Unterlagen koordinieren",
      "Neutrale, sachliche Zusammenfassungen erstellen",
    ],
    boundaries: [
      "Darf Kandidaten nicht autonom ablehnen",
      "Bewertet keine geschützten persönlichen Merkmale",
      "Zusammenfassungen bleiben strikt neutral und faktenbasiert",
    ],
    kpis: [
      { key: "applications_processed", label: "Verarbeitete Bewerbungen", unit: "Anzahl" },
      { key: "completeness_rate", label: "Vollständige Unterlagen", unit: "%" },
      { key: "processing_time", label: "Bearbeitungszeit", unit: "Stunden" },
    ],
    capabilities: [
      {
        key: "application-sorting",
        name: "Administrative Sortierung",
        description: "Sortiert Bewerbungen nach Stelle und Eingang.",
        defaultAutomationLevel: 3,
        maxAutomationLevel: 4,
        riskLevel: "medium",
        requiredTools: ["hr.read", "hr.write", "documents.read"],
      },
      {
        key: "completeness-check",
        name: "Vollständigkeits-Prüfung",
        description: "Prüft Unterlagen auf Vollständigkeit.",
        defaultAutomationLevel: 4,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["hr.read", "documents.read"],
      },
      {
        key: "neutral-summary",
        name: "Neutrale Zusammenfassung",
        description: "Erstellt faktenbasierte Kurzprofile ohne Bewertung geschützter Merkmale.",
        defaultAutomationLevel: 2,
        maxAutomationLevel: 3,
        riskLevel: "high",
        requiredTools: ["hr.read", "documents.read"],
      },
    ],
    requiredIntegrations: [],
    optionalIntegrations: ["email"],
    dataRequirements: ["Bewerbungsunterlagen", "Stellenprofile"],
    priceTier: "advanced",
    securityLevel: "elevated",
  }),

  defineAgent({
    slug: "interview-coordination",
    personaName: "David",
    roleTitle: "Interview Coordination Agent",
    department: "hr",
    tagline: "Interviews koordiniert, Leitfäden vorbereitet",
    description:
      "Koordiniert Interviewtermine, erstellt rollenbezogene, faire Interviewleitfäden und dokumentiert Feedback strukturiert.",
    responsibilities: [
      "Interviewtermine mit allen Beteiligten koordinieren",
      "Rollenbezogene, faire Interviewleitfäden erstellen",
      "Feedback strukturiert dokumentieren",
    ],
    boundaries: [
      "Bewertet keine geschützten persönlichen Merkmale",
      "Leitfäden folgen fairen, rollenbezogenen Kriterien",
      "Trifft keine Auswahlentscheidungen",
    ],
    kpis: [
      { key: "interviews_scheduled", label: "Koordinierte Interviews", unit: "Anzahl" },
      { key: "scheduling_time", label: "Zeit bis Terminfindung", unit: "Stunden" },
    ],
    capabilities: [
      {
        key: "interview-scheduling",
        name: "Terminkoordination",
        description: "Findet Termine für alle Beteiligten.",
        defaultAutomationLevel: 3,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["calendar.read", "calendar.write", "email.draft"],
      },
      {
        key: "guide-drafting",
        name: "Leitfaden-Erstellung",
        description: "Erstellt rollenbezogene Interviewleitfäden.",
        defaultAutomationLevel: 2,
        maxAutomationLevel: 3,
        riskLevel: "medium",
        requiredTools: ["hr.read", "knowledge.search"],
      },
    ],
    requiredIntegrations: ["calendar"],
    optionalIntegrations: ["email"],
    dataRequirements: ["Stellenprofile", "Kalenderzugang der Beteiligten"],
    priceTier: "advanced",
  }),

  defineAgent({
    slug: "onboarding",
    personaName: "Lisa",
    roleTitle: "Onboarding Agent",
    department: "hr",
    tagline: "Neue Mitarbeitende starten strukturiert",
    description:
      "Erstellt Onboarding-Pläne, sammelt Unterlagen, weist Schulungen und Ansprechpartner zu, überwacht den Fortschritt und erzeugt Checklisten.",
    responsibilities: [
      "Onboarding-Pläne erstellen",
      "Unterlagen sammeln",
      "Schulungen und Ansprechpartner zuweisen",
      "Fortschritt überwachen und Checklisten erzeugen",
    ],
    boundaries: [
      "Vergibt keine Systemzugänge selbst — er koordiniert Aufgaben dafür",
      "Personalentscheidungen bleiben beim Menschen",
    ],
    kpis: [
      { key: "onboardings_active", label: "Laufende Onboardings", unit: "Anzahl" },
      { key: "checklist_completion", label: "Checklisten-Fortschritt", unit: "%" },
    ],
    capabilities: [
      {
        key: "plan-creation",
        name: "Onboarding-Pläne",
        description: "Erstellt strukturierte Pläne mit Checklisten.",
        defaultAutomationLevel: 3,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["hr.read", "hr.write", "tasks.write"],
      },
      {
        key: "progress-tracking",
        name: "Fortschrittsüberwachung",
        description: "Überwacht offene Onboarding-Schritte und erinnert.",
        defaultAutomationLevel: 4,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["tasks.read", "notify.send"],
      },
    ],
    requiredIntegrations: [],
    dataRequirements: ["Onboarding-Vorlagen", "Rollenbeschreibungen"],
    priceTier: "advanced",
  }),

  defineAgent({
    slug: "leave-administration",
    personaName: "Omar",
    roleTitle: "Leave Administration Agent",
    department: "hr",
    tagline: "Abwesenheitsanträge formal geprüft",
    description:
      "Erfasst Anträge, prüft formale Vollständigkeit und Kalenderkonflikte und leitet an Berechtigte weiter — ohne autonome Entscheidung über streitige Fälle.",
    responsibilities: [
      "Abwesenheitsanträge erfassen",
      "Formale Vollständigkeit und Kalenderkonflikte prüfen",
      "An entscheidungsberechtigte Personen weiterleiten",
    ],
    boundaries: [
      "Entscheidet nicht autonom über streitige Fälle",
      "Genehmigt nur, wenn eine ausdrückliche Standardregel dies erlaubt",
    ],
    kpis: [
      { key: "requests_processed", label: "Verarbeitete Anträge", unit: "Anzahl" },
      { key: "conflicts_detected", label: "Erkannte Konflikte", unit: "Anzahl" },
    ],
    capabilities: [
      {
        key: "request-intake",
        name: "Antragsverarbeitung",
        description: "Erfasst und prüft Anträge formal.",
        defaultAutomationLevel: 4,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["hr.read", "hr.write", "calendar.read"],
      },
      {
        key: "routing",
        name: "Weiterleitung",
        description: "Leitet Anträge an Berechtigte weiter.",
        defaultAutomationLevel: 4,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["notify.send"],
      },
    ],
    requiredIntegrations: ["calendar"],
    dataRequirements: ["Abwesenheitsregeln", "Teamkalender"],
    priceTier: "simple",
  }),

  defineAgent({
    slug: "training",
    personaName: "Julia",
    roleTitle: "Training Agent",
    department: "hr",
    tagline: "Lernpfade aus Ihren Inhalten",
    description:
      "Empfiehlt interne Lerninhalte, erstellt Lernpfade, dokumentiert Abschlüsse und entwickelt Wissenschecks.",
    responsibilities: [
      "Interne Lerninhalte empfehlen",
      "Lernpfade erstellen",
      "Abschlüsse dokumentieren",
      "Wissenschecks entwickeln",
    ],
    boundaries: [
      "Empfiehlt nur freigegebene Inhalte",
      "Lernfortschritte sind nur für Berechtigte einsehbar",
    ],
    kpis: [
      { key: "paths_created", label: "Erstellte Lernpfade", unit: "Anzahl" },
      { key: "completions", label: "Dokumentierte Abschlüsse", unit: "Anzahl" },
    ],
    capabilities: [
      {
        key: "path-creation",
        name: "Lernpfad-Erstellung",
        description: "Baut Lernpfade aus internen Inhalten.",
        defaultAutomationLevel: 2,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["knowledge.search", "hr.write"],
      },
      {
        key: "quiz-creation",
        name: "Wissenschecks",
        description: "Erstellt Wissenschecks zu freigegebenen Inhalten.",
        defaultAutomationLevel: 2,
        maxAutomationLevel: 3,
        riskLevel: "low",
        requiredTools: ["knowledge.search"],
      },
    ],
    requiredIntegrations: [],
    dataRequirements: ["Freigegebene Schulungsinhalte"],
    priceTier: "simple",
  }),

  defineAgent({
    slug: "employee-feedback",
    personaName: "Noah",
    roleTitle: "Employee Feedback Agent",
    department: "hr",
    tagline: "Feedback strukturiert, Trends sichtbar",
    description:
      "Strukturiert Mitarbeiterfeedback, anonymisiert Daten sofern konfiguriert und erkennt Themen und Trends — ohne psychologische Diagnosen.",
    responsibilities: [
      "Feedback strukturieren",
      "Daten anonymisieren, sofern konfiguriert",
      "Themen und Trends erkennen",
    ],
    boundaries: [
      "Erstellt keine psychologischen Diagnosen",
      "Anonymität wird strikt gewahrt, wenn konfiguriert",
      "Keine Rückschlüsse auf Einzelpersonen in Berichten bei aktivierter Anonymisierung",
    ],
    kpis: [
      { key: "feedback_processed", label: "Verarbeitetes Feedback", unit: "Anzahl" },
      { key: "themes_identified", label: "Erkannte Themen", unit: "Anzahl" },
    ],
    capabilities: [
      {
        key: "feedback-structuring",
        name: "Strukturierung",
        description: "Ordnet Feedback Themen und Kategorien zu.",
        defaultAutomationLevel: 3,
        maxAutomationLevel: 4,
        riskLevel: "medium",
        requiredTools: ["hr.read", "hr.write"],
      },
      {
        key: "trend-analysis",
        name: "Trend-Analyse",
        description: "Erkennt wiederkehrende Themen und Entwicklungen.",
        defaultAutomationLevel: 2,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["hr.read", "reports.generate"],
      },
    ],
    requiredIntegrations: [],
    dataRequirements: ["Feedback-Daten", "Anonymisierungs-Konfiguration"],
    priceTier: "advanced",
    securityLevel: "elevated",
  }),

  defineAgent({
    slug: "hr-document",
    personaName: "Marta",
    roleTitle: "HR Document Agent",
    department: "hr",
    tagline: "HR-Dokumente aus geprüften Vorlagen",
    description:
      "Erstellt Dokumententwürfe aus freigegebenen Vorlagen, verwaltet Versionen und meldet fehlende Pflichtangaben — ersetzt keine arbeitsrechtliche Prüfung.",
    responsibilities: [
      "Dokumententwürfe aus freigegebenen Vorlagen erstellen",
      "Versionen verwalten",
      "Fehlende Pflichtangaben melden",
    ],
    boundaries: [
      "Ersetzt keine arbeitsrechtliche Prüfung",
      "Nutzt ausschließlich freigegebene Vorlagen",
      "Versendet keine Dokumente ohne Freigabe",
    ],
    kpis: [
      { key: "documents_drafted", label: "Erstellte Entwürfe", unit: "Anzahl" },
      { key: "missing_fields", label: "Gemeldete fehlende Angaben", unit: "Anzahl" },
    ],
    capabilities: [
      {
        key: "document-drafting",
        name: "Dokumenterstellung",
        description: "Füllt freigegebene Vorlagen mit vorhandenen Daten.",
        defaultAutomationLevel: 3,
        maxAutomationLevel: 3,
        riskLevel: "high",
        requiredTools: ["hr.read", "documents.write"],
      },
      {
        key: "version-management",
        name: "Versionsverwaltung",
        description: "Verwaltet Dokumentversionen nachvollziehbar.",
        defaultAutomationLevel: 4,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["documents.read", "documents.write"],
      },
    ],
    requiredIntegrations: [],
    dataRequirements: ["Freigegebene HR-Vorlagen", "Stammdaten"],
    priceTier: "advanced",
    securityLevel: "elevated",
  }),

  defineAgent({
    slug: "offboarding",
    personaName: "Erik",
    roleTitle: "Offboarding Agent",
    department: "hr",
    tagline: "Austritte vollständig und dokumentiert",
    description:
      "Erstellt Offboarding-Checklisten, koordiniert Rückgaben und Zugriffsbeendigung, sichert Wissen und dokumentiert den Abschluss.",
    responsibilities: [
      "Offboarding-Checklisten erstellen",
      "Rückgabe von Geräten und Zugriffsbeendigung koordinieren",
      "Wissenssicherung anstoßen",
      "Abschluss dokumentieren",
    ],
    boundaries: [
      "Beendet Zugriffe nicht selbst — er koordiniert und verfolgt die Aufgaben",
      "Arbeitsrechtliche Schritte bleiben beim Menschen",
    ],
    kpis: [
      { key: "offboardings_completed", label: "Abgeschlossene Offboardings", unit: "Anzahl" },
      { key: "checklist_completion", label: "Checklisten-Vollständigkeit", unit: "%" },
    ],
    capabilities: [
      {
        key: "checklist-creation",
        name: "Checklisten",
        description: "Erstellt vollständige Offboarding-Checklisten.",
        defaultAutomationLevel: 3,
        maxAutomationLevel: 4,
        riskLevel: "low",
        requiredTools: ["hr.read", "tasks.write"],
      },
      {
        key: "knowledge-capture",
        name: "Wissenssicherung",
        description: "Stößt die Dokumentation von Schlüsselwissen an.",
        defaultAutomationLevel: 2,
        maxAutomationLevel: 3,
        riskLevel: "low",
        requiredTools: ["knowledge.write", "tasks.write"],
      },
    ],
    requiredIntegrations: [],
    dataRequirements: ["Offboarding-Vorlagen", "Zugriffs- und Geräteliste"],
    priceTier: "simple",
  }),
];
