import { spectrum, prism } from "@spectra/design-tokens";
import type { TemplateContext } from "../../pipeline/types";

/** Ordered archetype matchers — first keyword hit wins; landing is the default. */
const MATCHERS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["kanban", ["kanban", "board", "backlog", "sprint", "trello", "swimlane"]],
  ["calculator", ["calculator", "calculate", "calc", "arithmetic"]],
  ["dashboard", ["dashboard", "analytics", "metrics", "stats", "statistic", "kpi", "chart", "graph", "report", "insight"]],
  ["timer", ["timer", "pomodoro", "stopwatch", "countdown", "clock"]],
  ["notes", ["note", "notepad", "scratchpad", "markdown", "journal", "memo", "diary"]],
  ["form", ["form", "contact", "sign up", "signup", "sign-up", "login", "log in", "subscribe", "feedback", "survey", "waitlist", "newsletter"]],
  ["pricing", ["pricing", "price", "plans", "subscription", "tier", "package", "billing"]],
  ["todo", ["todo", "to-do", "to do", "task", "checklist", "reminder", "habit"]],
  ["landing", ["landing", "hero", "website", "startup", "product", "saas", "portfolio", "app", "page"]],
];

/** Accent keyword → spectral hex. */
const ACCENTS: ReadonlyArray<readonly [readonly string[], string]> = [
  [["violet", "purple", "indigo"], spectrum.violet],
  [["blue", "azure"], spectrum.blue],
  [["cyan", "teal", "aqua"], spectrum.cyan],
  [["green", "emerald", "mint"], prism.mint],
  [["pink", "rose", "magenta", "red"], prism.rose],
];

export function normalizeIntent(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Whole-word match so "board" does not fire inside "dashboard". */
function hasKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|\\W)" + escaped + "($|\\W)").test(text);
}

export function classifyArchetype(normalized: string): string {
  for (const [archetype, keywords] of MATCHERS) {
    if (keywords.some((k) => hasKeyword(normalized, k))) return archetype;
  }
  return "landing";
}

function pickAccent(normalized: string): string {
  for (const [keywords, hex] of ACCENTS) {
    if (keywords.some((k) => normalized.includes(k))) return hex;
  }
  return spectrum.violet;
}

const TITLE_CASE = (s: string) =>
  s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bA\b/g, "a").replace(/\bAn\b/g, "an");

/** Derive a clean human title from the raw intent. */
export function deriveTitle(raw: string, archetype: string): string {
  let t = raw
    .trim()
    .replace(/^(please\s+)?(make|create|build|generate|give me|i want|i need|design|show me)\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (!t) t = archetype;
  // Keep it short.
  const words = t.split(/\s+/).slice(0, 7).join(" ");
  const cased = TITLE_CASE(words);
  return cased.charAt(0).toUpperCase() + cased.slice(1);
}

const LABELS: Record<string, string> = {
  todo: "Task List",
  kanban: "Kanban Board",
  calculator: "Calculator",
  dashboard: "Analytics Dashboard",
  timer: "Focus Timer",
  notes: "Notes",
  form: "Contact Form",
  pricing: "Pricing",
  landing: "Landing Page",
};

export function archetypeLabel(archetype: string): string {
  return LABELS[archetype] ?? "Application";
}

export function ingestIntent(raw: string): {
  normalized: string;
  archetype: string;
  title: string;
  params: TemplateContext;
} {
  const normalized = normalizeIntent(raw);
  const archetype = classifyArchetype(normalized);
  const title = deriveTitle(raw, archetype);
  return {
    normalized,
    archetype,
    title,
    params: { title, intent: raw.trim(), accent: pickAccent(normalized) },
  };
}
