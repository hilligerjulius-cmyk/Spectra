import type { DepartmentDefinition, DepartmentSlug } from "./types";

export const departments: Record<DepartmentSlug, DepartmentDefinition> = {
  leadership: {
    slug: "leadership",
    name: "Leadership",
    shortName: "Leadership",
    tagline: "Koordination für Ihr gesamtes digitales Team",
    description:
      "Der AI Chief of Staff priorisiert eingehende Informationen, delegiert Aufgaben an zuständige Agenten, bündelt Freigaben und erstellt Ihre Tages- und Wochenbriefings.",
    bundlePriceCents: null,
  },
  sales: {
    slug: "sales",
    name: "AI Sales Department",
    shortName: "Sales",
    tagline: "Mehr Pipeline, weniger liegengebliebene Chancen",
    description:
      "Von der Zielkundenrecherche über Qualifizierung und Follow-ups bis zu Angeboten, CRM-Pflege und Forecasts — acht spezialisierte Vertriebs-Agenten.",
    bundlePriceCents: 249900,
  },
  office: {
    slug: "office",
    name: "AI Office Department",
    shortName: "Office",
    tagline: "Posteingang, Kalender und Aufgaben unter Kontrolle",
    description:
      "E-Mail-Triage, Antwortentwürfe, Terminkoordination, Meeting-Protokolle, Aufgabenverfolgung, Dokumentenablage, Erinnerungen und Reiseplanung.",
    bundlePriceCents: 199900,
  },
  finance: {
    slug: "finance",
    name: "AI Finance Operations Department",
    shortName: "Finance Ops",
    tagline: "Operative Finanzarbeit ohne liegengebliebene Belege",
    description:
      "Rechnungseingang, Zahlungsüberwachung, Mahnentwürfe, Spesenprüfung, Liquiditätsübersichten, Monatsberichte, Belegverarbeitung und Budgetüberwachung.",
    bundlePriceCents: 229900,
    disclaimer:
      "Diese Agenten leisten ausschließlich operative Unterstützung. Sie ersetzen keine Buchhaltung, Steuerberatung, Abschlussprüfung oder Finanzberatung.",
  },
  hr: {
    slug: "hr",
    name: "AI HR Operations Department",
    shortName: "HR Ops",
    tagline: "Administrative Personalarbeit, fair und nachvollziehbar",
    description:
      "Bewerbungsadministration, Interviewkoordination, Onboarding, Abwesenheiten, Schulungen, Feedback-Strukturierung, HR-Dokumente und Offboarding.",
    bundlePriceCents: 199900,
    disclaimer:
      "Keine automatisierten endgültigen Personalentscheidungen. Keine diskriminierende Bewertung. Die Entscheidungshoheit verbleibt beim Menschen.",
  },
  "customer-service": {
    slug: "customer-service",
    name: "AI Customer Service Department",
    shortName: "Customer Service",
    tagline: "Schnellere Antworten, sichere Eskalationen",
    description:
      "Anfragenbeantwortung aus der Wissensbasis, Ticket-Routing, Eskalationserkennung, Bewertungsmanagement, Kundenrückgewinnung, Reklamationen und Qualitätsanalyse.",
    bundlePriceCents: 219900,
  },
  operations: {
    slug: "operations",
    name: "AI Operations Department",
    shortName: "Operations",
    tagline: "Prozesse sichtbar machen, Engpässe beseitigen",
    description:
      "Prozesserkennung, Aufgabenüberwachung, Fristenmanagement, Kapazitätsanalyse, Qualitätsprüfung, Lieferantenverwaltung, Projektstatus und Engpassanalyse.",
    bundlePriceCents: 219900,
  },
  knowledge: {
    slug: "knowledge",
    name: "AI Knowledge Department",
    shortName: "Knowledge",
    tagline: "Ihr Unternehmenswissen — auffindbar und aktuell",
    description:
      "Dokumentenintelligenz, berechtigungsabhängiges Unternehmensgedächtnis, Recherche, Meeting-Wissen, SOPs, semantische Suche, Aktualitätsprüfung und Schulungsinhalte.",
    bundlePriceCents: 199900,
  },
};

export const departmentList = Object.values(departments);
