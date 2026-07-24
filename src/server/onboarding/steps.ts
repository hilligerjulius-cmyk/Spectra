/**
 * Die 14 Schritte des Einrichtungsassistenten (Spec §14).
 *
 * Reihenfolge ist bewusst gewählt: erst verstehen (1–4), dann empfehlen und
 * entscheiden (5–6), dann Voraussetzungen schaffen (7–11), dann bauen und
 * testen (12–13) und erst danach aktivieren (14). Ein Agent kann in diesem
 * Ablauf nie produktiv laufen, bevor ein Sandbox-Testlauf bestanden wurde.
 */
export interface OnboardingStepDef {
  key: string;
  index: number;
  title: string;
  description: string;
  /** Kann der Schritt übersprungen werden, ohne die Einrichtung zu gefährden? */
  optional: boolean;
}

export const ONBOARDING_STEPS: OnboardingStepDef[] = [
  {
    key: "welcome",
    index: 1,
    title: "Willkommen",
    description:
      "Was WORKFORCE OS leistet — und was ausdrücklich nicht. Grenzen und Verantwortlichkeiten vorab.",
    optional: false,
  },
  {
    key: "company",
    index: 2,
    title: "Unternehmensprofil",
    description: "Branche und Unternehmensgröße für passende Empfehlungen.",
    optional: false,
  },
  {
    key: "pain-points",
    index: 3,
    title: "Zeitfresser",
    description: "Wo im Alltag geht heute die meiste Zeit verloren?",
    optional: false,
  },
  {
    key: "departments",
    index: 4,
    title: "Bereiche",
    description: "In welchen Bereichen soll Ihr digitales Team arbeiten?",
    optional: false,
  },
  {
    key: "recommendation",
    index: 5,
    title: "Team-Empfehlung",
    description:
      "Serverseitig berechneter Vorschlag mit Begründung je Agent — frei anpassbar.",
    optional: false,
  },
  {
    key: "plan",
    index: 6,
    title: "Plan",
    description: "Plattformplan und Abrechnungsintervall wählen.",
    optional: false,
  },
  {
    key: "data-sources",
    index: 7,
    title: "Datenquellen",
    description:
      "Verfügbare Connectoren verbinden. Nicht verbundene Quellen bleiben für Agenten gesperrt.",
    optional: true,
  },
  {
    key: "knowledge",
    index: 8,
    title: "Wissensbasis",
    description:
      "Interne Dokumente hochladen, damit Agenten mit Quellenangabe antworten können.",
    optional: true,
  },
  {
    key: "team",
    index: 9,
    title: "Team & Rollen",
    description:
      "Kolleginnen und Kollegen einladen und Rollen vergeben (Freigabeberechtigungen).",
    optional: true,
  },
  {
    key: "automation",
    index: 10,
    title: "Automatisierungsstufen",
    description:
      "Wie weit sollen Agenten selbstständig handeln dürfen? Standard ist Freigabe durch Menschen.",
    optional: false,
  },
  {
    key: "approvals",
    index: 11,
    title: "Freigaberegeln",
    description:
      "Wer entscheidet über Aktionen mit finanzieller, rechtlicher oder personeller Wirkung?",
    optional: false,
  },
  {
    key: "notifications",
    index: 12,
    title: "Benachrichtigungen",
    description: "Wann und worüber möchten Sie informiert werden?",
    optional: true,
  },
  {
    key: "sandbox-run",
    index: 13,
    title: "Sandbox-Testlauf",
    description:
      "Jeder Agent absolviert einen Testlauf ohne Außenwirkung. Ohne bestandenen Testlauf keine Aktivierung.",
    optional: false,
  },
  {
    key: "activate",
    index: 14,
    title: "Aktivierung",
    description:
      "Zusammenfassung prüfen und Agenten aus der Sandbox in den Produktivbetrieb übernehmen.",
    optional: false,
  },
];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

export function getStep(index: number): OnboardingStepDef | undefined {
  return ONBOARDING_STEPS.find((s) => s.index === index);
}
