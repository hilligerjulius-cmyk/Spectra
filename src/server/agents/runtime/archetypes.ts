/**
 * Fähigkeits-Archetypen.
 *
 * Der Katalog beschreibt 57 Agenten mit über 100 Fähigkeiten. Statt für jede
 * Fähigkeit eigenen Code zu schreiben, ordnet diese Datei jede Fähigkeit einem
 * Archetyp zu; die Runtime führt dann den passenden generischen Handler aus.
 * Sieben Agenten haben darüber hinaus vertiefte, agentenspezifische Handler
 * (`implementationDepth: "deep"`), die immer Vorrang haben.
 *
 * Die Zuordnung erfolgt bewusst über explizite Muster statt über Heuristik zur
 * Laufzeit: Sie ist damit lesbar, testbar und bei neuen Katalogeinträgen
 * überprüfbar (siehe tests/unit/archetypes.test.ts — jede Katalogfähigkeit muss
 * einem Archetyp zugeordnet sein).
 */

export type CapabilityArchetype =
  | "monitor"
  | "classify"
  | "extract"
  | "draft"
  | "summarize"
  | "report"
  | "checklist"
  | "qa"
  | "analysis";

/** Endungen/Präfixe je Archetyp; die erste Übereinstimmung gewinnt. */
const PATTERNS: { archetype: CapabilityArchetype; match: RegExp }[] = [
  // Frage-Antwort mit Quellenbindung
  { archetype: "qa", match: /^(qa-with-sources|semantic-search|auto-answer)$/ },
  // Berichte aus vorhandenen Daten
  {
    archetype: "report",
    match:
      /(-reporting|-report|-overview|-collection|^report-generation$|^forecast$|^liquidity-overview$)$/,
  },
  // Strukturierte Extraktion und Prüfung von Feldern
  {
    archetype: "extract",
    match:
      /(-extraction|-check|-validation|^field-|^duplicate-|^document-processing$|^payment-matching$|^supplier-data$|^completeness-check$)/,
  },
  // Einordnen, priorisieren, zuweisen
  {
    archetype: "classify",
    match:
      /(-classification|^classify$|^classification$|-routing|^routing$|-scoring|-sorting|^assign-owner$|^team-assignment$|^cost-assignment$|^prioritize$|^delegate$|^escalation$|^uncertainty-escalation$)/,
  },
  // Textentwürfe und Vorschläge
  {
    archetype: "draft",
    match:
      /(-drafting|-proposal|-proposals|-suggestions|-suggestion|-questions|^outreach-|^sequence-design$|^slot-proposal$|^rebalance-proposal$)/,
  },
  // Zusammenfassen und Verdichten
  {
    archetype: "summarize",
    match:
      /(-summary|^summarize$|^summarization$|-briefing|^knowledge-capture$|^feedback-structuring$|^memory-building$|^process-documentation$|^neutral-summary$|-research$|^external-research$|^internal-research$|^icp-research$|^option-research$)/,
  },
  // Aufgaben-/Ablauflisten erzeugen
  {
    archetype: "checklist",
    match:
      /(-creation|^checklist-audit$|^plan-creation$|^task-creation$|^booking-preparation$|^interview-scheduling$|^record-maintenance$|^version-management$|^sop-versioning$|^protocol-indexing$|^reminders$|^reminder-send$|^multi-stage-reminder$|^reminder-escalation$|^review-task$|^request-intake$|^complaint-intake$|^approved-send$|^followup-send$)/,
  },
  // Beobachten, erkennen, warnen
  {
    archetype: "monitor",
    match:
      /(-watch|-detection|-alert|-tracking|-analysis|^deal-risk$|^budget-comparison$|^policy-check$|^freshness-check$|^gap-detection$)/,
  },
];

/** Explizite Ausnahmen, die von den Mustern abweichen. */
const OVERRIDES: Record<string, CapabilityArchetype> = {
  // Fristen aus Text ziehen ist Extraktion, nicht Beobachtung.
  "deadline-extraction": "extract",
  // "task-extraction" hat einen eigenen, vertieften Handler; Fallback bleibt Extraktion.
  "task-extraction": "extract",
  // Priorisierung entscheidet über Reihenfolge, ordnet aber nicht ein.
  prioritize: "classify",
  // "risk-watch"/"risk-detection" sind Beobachtung, auch mit "-detection".
  "risk-watch": "monitor",
  "risk-detection": "monitor",
  // Antwortentwürfe bleiben Entwürfe, obwohl "answer" enthalten ist.
  "answer-drafting": "draft",
};

export function classifyCapability(key: string): CapabilityArchetype {
  const override = OVERRIDES[key];
  if (override) return override;
  for (const { archetype, match } of PATTERNS) {
    if (match.test(key)) return archetype;
  }
  return "analysis";
}
