import type { CapabilityHandler } from "./engine";

/**
 * Handler-Registry: ordnet Fähigkeiten ihre Ausführungslogik zu.
 * Auflösungsreihenfolge:
 *   1. "<definitionSlug>:<capabilityKey>"  (agentenspezifisch, vertieft)
 *   2. "capability:<capabilityKey>"        (fähigkeitsspezifisch, geteilt)
 *   3. generischer Analyse-Handler         (alle übrigen Agenten)
 * Neue Agenten benötigen dadurch keinen Code — nur Katalogdaten; vertiefte
 * Logik wird gezielt registriert (siehe docs/agent-development.md).
 */

const handlers = new Map<string, CapabilityHandler>();

export function registerHandler(
  key: string,
  handler: CapabilityHandler,
  options: { overwrite?: boolean } = {},
): void {
  // Vertiefte Handler werden zuerst geladen; die Archetyp-Registrierung darf
  // sie nicht verdrängen (overwrite: false).
  if (options.overwrite === false && handlers.has(key)) return;
  handlers.set(key, handler);
}

/** Nur für Tests/Diagnose: Ist für diesen Schlüssel ein Handler registriert? */
export function hasHandler(key: string): boolean {
  return handlers.has(key);
}

export function resolveHandler(
  definitionSlug: string,
  capabilityKey: string,
): CapabilityHandler {
  return (
    handlers.get(`${definitionSlug}:${capabilityKey}`) ??
    handlers.get(`capability:${capabilityKey}`) ??
    genericAnalysisHandler
  );
}

/**
 * Generischer Handler: Beobachten/Analysieren auf Basis der übergebenen Daten.
 * Führt keine Aktionen aus außer risikoarmen Benachrichtigungen bei
 * kritischen Befunden (sofern Stufe und Tool-Berechtigungen es erlauben).
 */
export const genericAnalysisHandler: CapabilityHandler = async (ctx) => {
  const inputText =
    typeof ctx.input.text === "string" && ctx.input.text.length > 0
      ? ctx.input.text
      : JSON.stringify(ctx.input, null, 2);

  await ctx.recordStep("retrieve", "Eingangsdaten übernommen", {
    zeichen: inputText.length,
  });

  const analysis = await ctx.ai(
    "generic.analysis",
    `Agentenrolle: ${ctx.definition.roleTitle}\nFähigkeit: ${ctx.capability.name} — ${ctx.capability.description}\n\nDaten:\n${inputText.slice(0, 8000)}`,
  );

  const critical = analysis.findings.filter(
    (f) => f.severity === "warnung" || f.severity === "kritisch",
  );
  if (
    critical.length > 0 &&
    ctx.level >= 1 &&
    ctx.capability.requiredTools.includes("notify.send") &&
    ctx.instance.allowedTools.includes("notify.send")
  ) {
    await ctx.invokeTool("notify.send", {
      type: "risk_detected",
      title: `${ctx.instance.displayName}: ${critical[0]!.title}`,
      body: critical[0]!.detail,
      href: `/app/agents/${ctx.instance.id}`,
    });
  }

  return {
    summary: analysis.summary,
    output: {
      findings: analysis.findings,
      recommendations: analysis.recommendations,
    },
  };
};
