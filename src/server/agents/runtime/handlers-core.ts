import { registerHandler } from "./handlers";
import type { CapabilityHandler } from "./engine";

/**
 * Vertiefte Capability-Handler des Kerns (Phase 5/6).
 * Wird von der Engine per Seiteneffekt-Import geladen.
 */

/** Task Agent — Aufgaben aus Text extrahieren und als vorbereitete Aktionen anlegen. */
const taskExtractionHandler: CapabilityHandler = async (ctx) => {
  const text = String(ctx.input.text ?? "");
  if (!text.trim()) {
    return { summary: "Keine Eingabedaten — es wurden keine Aufgaben extrahiert." };
  }
  await ctx.recordStep("retrieve", "Quelltext übernommen", {
    zeichen: text.length,
    quelle: ctx.input.sourceType ?? "manuell",
  });

  const extraction = await ctx.ai("tasks.extract", text);
  if (extraction.tasks.length === 0) {
    return { summary: "Im Text wurden keine konkreten Aufgaben erkannt." };
  }
  await ctx.recordStep("validate", `${extraction.tasks.length} Aufgaben-Kandidaten geprüft`);

  let executed = 0;
  let drafted = 0;
  let awaiting = 0;
  for (const t of extraction.tasks.slice(0, 5)) {
    const outcome = await ctx.prepareAction({
      actionType: "task.create",
      title: `Aufgabe anlegen: ${t.title}`,
      reasoning: `Im ${String(ctx.input.sourceType ?? "Text")} wurde eine konkrete Aufgabe erkannt${t.dueDate ? ` (Frist: ${t.dueDate})` : ""}.`,
      payload: {
        title: t.title,
        description: t.description,
        dueAt: t.dueDate,
        priority: t.priority,
        source: {
          type: ctx.input.sourceType ?? "text",
          ref: ctx.input.sourceRef ?? null,
        },
      },
      affectedData: { vorschau: t },
      riskLevel: "low",
    });
    if (outcome.mode === "executed") executed++;
    else if (outcome.mode === "approval_requested") awaiting++;
    else drafted++;
  }

  const parts: string[] = [];
  if (executed > 0) parts.push(`${executed} Aufgabe(n) angelegt`);
  if (awaiting > 0) parts.push(`${awaiting} zur Freigabe vorgelegt`);
  if (drafted > 0) parts.push(`${drafted} als Entwurf dokumentiert`);
  return {
    summary: `${extraction.tasks.length} Aufgabe(n) erkannt: ${parts.join(", ")}.`,
    output: { tasks: extraction.tasks },
  };
};

registerHandler("capability:task-extraction", taskExtractionHandler);
