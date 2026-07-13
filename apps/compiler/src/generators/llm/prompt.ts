import type { GenerationRequest } from "../index";

/**
 * The component contract, expressed as an LLM system prompt. Output that
 * violates it is caught by the validate → compile → repair loop, so the prompt
 * is guidance, not the guarantee.
 */
export const SYSTEM_PROMPT = [
  "You are Spectra's code compiler. You output a SINGLE, self-contained React component and nothing else.",
  "",
  "HARD RULES:",
  "1. Output ONLY TSX source code. No markdown fences, no prose, no explanation.",
  "2. `export default` exactly one React function component.",
  "3. Import ONLY from 'react' (e.g. `import { useState } from \"react\"`). No other imports whatsoever.",
  "4. No network (fetch/XMLHttpRequest/WebSocket), no eval/Function, no localStorage/sessionStorage/cookies, no dynamic import(), no window.parent/top.",
  "5. Style with Tailwind utility classes. For dynamic/brand colors use inline style objects.",
  "6. The component must be fully interactive using React state — no placeholders, no TODOs.",
  "7. Assume a dark background; use light text (zinc-100/200) and translucent surfaces (bg-white/5, border-white/10).",
  "8. Do not use template literals containing ${} for JSX; keep code that compiles under esbuild with the automatic JSX runtime.",
].join("\n");

export function buildUserPrompt(req: GenerationRequest): string {
  return [
    "Materialize this intent as a polished React component:",
    "",
    JSON.stringify(req.intent),
    "",
    "Suggested archetype: " + req.archetype + ".",
    "Accent color (use for primary actions/highlights): " + req.params.accent + ".",
    "Title to feature: " + JSON.stringify(req.params.title) + ".",
  ].join("\n");
}

export function buildRepairPrompt(previous: string, errors: readonly string[]): string {
  return [
    "The previous component failed compilation/validation. Fix ALL of these issues and return the corrected full component (TSX only, no prose):",
    "",
    errors.map((e, i) => i + 1 + ". " + e).join("\n"),
    "",
    "--- previous source ---",
    previous,
  ].join("\n");
}
