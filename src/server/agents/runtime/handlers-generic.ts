import { registerHandler } from "./handlers";
import { isToolImplemented } from "./tools";
import { classifyCapability, type CapabilityArchetype } from "./archetypes";
import type { CapabilityHandler, HandlerContext } from "./engine";

/**
 * Generische Capability-Handler je Archetyp.
 *
 * Diese Handler führen echte Arbeit aus — sie rufen den KI-Provider auf,
 * lesen und schreiben Plattformdaten über die Tool-Registry und durchlaufen
 * dieselbe Freigabelogik wie die vertieften Handler. Was sie nicht tun:
 * fachspezifische Sonderregeln eines einzelnen Agenten abbilden. Wo das nötig
 * ist, existiert ein agentenspezifischer Handler in handlers-core.ts.
 *
 * Zwei Grundsätze gelten in allen Handlern:
 *  - Es wird nur genutzt, was die Fähigkeit ausdrücklich braucht und die
 *    Instanz freigegeben hat (`canUse`).
 *  - Fehlende Informationen werden benannt, nicht ergänzt.
 */

const MAX_INPUT_CHARS = 8000;

function inputText(ctx: HandlerContext): string {
  const raw = ctx.input.text ?? ctx.input.question ?? ctx.input.content;
  if (typeof raw === "string" && raw.trim().length > 0) return raw;
  return JSON.stringify(ctx.input, null, 2);
}

/**
 * Ein Tool ist nutzbar, wenn die Fähigkeit es braucht, die Instanz es
 * freigegeben hat und es tatsächlich implementiert ist. Die dritte Bedingung
 * ist bewusst enthalten: Für Connectoren ohne Implementierung oder ohne
 * Zugangsdaten soll der Agent den fehlenden Zugriff benennen, statt mit einem
 * technischen Fehler abzubrechen.
 */
function canUse(ctx: HandlerContext, toolKey: string): boolean {
  return (
    ctx.capability.requiredTools.includes(toolKey) &&
    ctx.instance.allowedTools.includes(toolKey) &&
    isToolImplemented(toolKey)
  );
}

/** Welche benötigten Tools fehlen — für ehrliche Ergebnismeldungen. */
function unavailableTools(ctx: HandlerContext): string[] {
  return ctx.capability.requiredTools.filter((t) => !isToolImplemented(t));
}

function roleContext(ctx: HandlerContext): string {
  return [
    `Agentenrolle: ${ctx.definition.roleTitle}`,
    `Fähigkeit: ${ctx.capability.name} — ${ctx.capability.description}`,
    `Grenzen: ${ctx.definition.boundaries.join(" | ")}`,
    ctx.definition.systemPrompt,
  ].join("\n");
}

/* ========================================================================== */
/* monitor — beobachten, Auffälligkeiten melden, nichts verändern             */
/* ========================================================================== */

/**
 * Meldet einmal je Lauf, welche benötigten Anbindungen fehlen. So steht die
 * Einschränkung in der Timeline, statt still zu verschwinden.
 */
async function noteUnavailableTools(ctx: HandlerContext): Promise<string[]> {
  const missing = unavailableTools(ctx);
  if (missing.length > 0) {
    await ctx.recordStep(
      "plan",
      `${missing.length} benötigte Anbindung(en) nicht verfügbar`,
      {
        tools: missing,
        hinweis:
          "Die Fähigkeit läuft mit eingeschränktem Zugriff. Nicht verbundene Quellen werden nicht ersetzt oder simuliert.",
      },
    );
  }
  return missing;
}

const monitorHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  await noteUnavailableTools(ctx);
  await ctx.recordStep("retrieve", "Eingangsdaten übernommen", {
    zeichen: text.length,
  });

  const analysis = await ctx.ai(
    "generic.analysis",
    text.slice(0, MAX_INPUT_CHARS),
    roleContext(ctx),
  );

  const critical = analysis.findings.filter(
    (f) => f.severity === "warnung" || f.severity === "kritisch",
  );

  if (critical.length > 0 && canUse(ctx, "notify.send")) {
    // Beobachtung ist ab Stufe 1 erlaubt; die Meldung selbst ist risikoarm.
    await ctx.invokeTool("notify.send", {
      type: "risk_detected",
      title: `${ctx.instance.displayName}: ${critical[0]!.title}`,
      body: critical
        .slice(0, 3)
        .map((f) => `${f.title}: ${f.detail}`)
        .join("\n"),
      href: `/app/agents/${ctx.instance.id}`,
    });
  }

  return {
    summary:
      critical.length > 0
        ? `${critical.length} auffällige(r) Befund(e): ${critical[0]!.title}`
        : analysis.summary,
    output: {
      findings: analysis.findings,
      recommendations: analysis.recommendations,
    },
  };
};

/* ========================================================================== */
/* classify — einordnen, priorisieren, Zuständigkeit vorschlagen              */
/* ========================================================================== */

const classifyHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  const missing = await noteUnavailableTools(ctx);
  const result = await ctx.ai(
    "generic.classify",
    text.slice(0, MAX_INPUT_CHARS),
    roleContext(ctx),
  );

  await ctx.recordStep("validate", "Einordnung geprüft", {
    kategorie: result.category,
    prioritaet: result.priority,
    konfidenz: result.confidence,
  });

  // Bei geringer Konfidenz keine Aktion vorbereiten, sondern eskalieren.
  if (result.confidence === "gering") {
    if (canUse(ctx, "notify.send")) {
      await ctx.invokeTool("notify.send", {
        type: "uncertain_classification",
        title: `${ctx.instance.displayName}: Einordnung unsicher`,
        body: `Der Vorgang konnte nicht belastbar eingeordnet werden (${result.rationale}). Bitte manuell prüfen.`,
        href: `/app/agents/${ctx.instance.id}`,
      });
    }
    return {
      summary:
        "Einordnung war nicht belastbar möglich — der Vorgang wurde zur manuellen Prüfung gemeldet.",
      output: { ...result, escalated: true },
    };
  }

  // Dringende Vorgänge erhalten eine nachverfolgbare Aufgabe.
  if (
    (result.priority === "urgent" || result.priority === "high") &&
    canUse(ctx, "tasks.write")
  ) {
    await ctx.prepareAction({
      actionType: "task.create",
      title: `Vorgang bearbeiten: ${result.category} (${result.priority})`,
      reasoning: result.rationale,
      riskLevel: "low",
      payload: {
        title: `${ctx.definition.roleTitle}: ${result.category} — Priorität ${result.priority}`,
        description: `${result.rationale}\n\nVorgeschlagene Zuständigkeit: ${result.suggestedOwnerRole ?? "nicht bestimmbar"}`,
        priority: result.priority,
        source: { runId: ctx.runId, capability: ctx.capability.key },
      },
      affectedData: { kategorie: result.category },
    });
  }

  return {
    summary:
      `Eingeordnet als "${result.category}" mit Priorität "${result.priority}" (Konfidenz ${result.confidence}).` +
      (missing.length > 0
        ? ` Hinweis: ${missing.length} benötigte Anbindung(en) fehlen.`
        : ""),
    output: { ...result, unavailableTools: missing },
  };
};

/* ========================================================================== */
/* extract — Felder herausziehen und Lücken benennen                          */
/* ========================================================================== */

const extractHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  const missing = await noteUnavailableTools(ctx);
  const result = await ctx.ai(
    "generic.extract",
    text.slice(0, MAX_INPUT_CHARS),
    roleContext(ctx),
  );

  await ctx.recordStep("validate", "Extraktion geprüft", {
    gefundene_felder: result.fields.length,
    fehlende_felder: result.missingFields.length,
  });

  // Lücken werden gemeldet, nicht gefüllt.
  if (result.missingFields.length > 0 && canUse(ctx, "tasks.write")) {
    await ctx.prepareAction({
      actionType: "task.create",
      title: `Fehlende Angaben klären (${result.missingFields.length})`,
      reasoning: `Folgende erwartete Felder fehlen in den Daten: ${result.missingFields.join(", ")}. Sie wurden bewusst nicht ergänzt.`,
      riskLevel: "low",
      payload: {
        title: `${ctx.definition.roleTitle}: fehlende Angaben klären`,
        description: `Fehlend: ${result.missingFields.join(", ")}\n\nGefunden: ${result.fields.map((f) => `${f.name} = ${f.value}`).join(", ") || "keine"}`,
        priority: "normal",
        source: { runId: ctx.runId, capability: ctx.capability.key },
      },
      affectedData: { fehlend: result.missingFields },
    });
  }

  return {
    summary:
      result.fields.length > 0
        ? `${result.fields.length} Feld(er) extrahiert${result.missingFields.length > 0 ? `, ${result.missingFields.length} fehlen` : ""}.`
        : "Keine verwertbaren Felder gefunden — es wurde nichts ergänzt.",
    output: { ...result, unavailableTools: missing },
  };
};

/* ========================================================================== */
/* draft — Entwurf erstellen, nie ungeprüft versenden                         */
/* ========================================================================== */

const draftHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  const missing = await noteUnavailableTools(ctx);
  const draft = await ctx.ai(
    "generic.draft",
    text.slice(0, MAX_INPUT_CHARS),
    roleContext(ctx),
  );

  await ctx.recordStep("draft", "Entwurf erstellt", {
    offene_punkte: draft.openQuestions.length,
  });

  // Versand ist nie automatisch: Es entsteht ein Entwurf bzw. eine Freigabe.
  if (canUse(ctx, "email.draft")) {
    await ctx.prepareAction({
      actionType: "email.draft",
      title: `Entwurf: ${draft.title}`,
      reasoning:
        draft.openQuestions.length > 0
          ? `Vor Verwendung zu klären: ${draft.openQuestions.join("; ")}`
          : "Entwurf ausschließlich auf Basis der übergebenen Daten erstellt.",
      riskLevel: "medium",
      payload: {
        to: String(ctx.input.recipient ?? ctx.input.to ?? ""),
        subject: draft.title,
        body: draft.body,
      },
      affectedData: { offene_punkte: draft.openQuestions },
    });
  } else if (canUse(ctx, "tasks.write")) {
    await ctx.prepareAction({
      actionType: "task.create",
      title: `Entwurf prüfen: ${draft.title}`,
      reasoning:
        "Für diese Fähigkeit ist kein Versandkanal freigegeben — der Entwurf wird zur menschlichen Prüfung als Aufgabe hinterlegt.",
      riskLevel: "low",
      payload: {
        title: `Entwurf prüfen: ${draft.title}`.slice(0, 200),
        description: `${draft.body}\n\nOffene Punkte: ${draft.openQuestions.join("; ") || "keine"}`,
        priority: "normal",
        source: { runId: ctx.runId, capability: ctx.capability.key },
      },
    });
  }

  return {
    summary:
      `Entwurf "${draft.title}" erstellt${draft.openQuestions.length > 0 ? ` — ${draft.openQuestions.length} offene(r) Punkt(e)` : ""}.` +
      (missing.length > 0
        ? ` Versandkanal nicht verbunden (${missing.join(", ")}).`
        : ""),
    output: { ...draft, unavailableTools: missing },
  };
};

/* ========================================================================== */
/* summarize — verdichten ohne zu interpretieren                              */
/* ========================================================================== */

const summarizeHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  if (text.trim().length < 20) {
    return {
      summary:
        "Zu wenig Text für eine Zusammenfassung. Es wurde bewusst nichts erfunden.",
    };
  }
  await noteUnavailableTools(ctx);
  const result = await ctx.ai(
    "text.summarize",
    text.slice(0, MAX_INPUT_CHARS),
    roleContext(ctx),
  );
  return {
    summary: result.summary,
    output: { summary: result.summary, keyPoints: result.keyPoints },
  };
};

/* ========================================================================== */
/* report — Bericht aus tatsächlichen Plattformdaten                          */
/* ========================================================================== */

const reportHandler: CapabilityHandler = async (ctx) => {
  const missing = await noteUnavailableTools(ctx);
  const sections: { title: string; lines: string[] }[] = [];

  if (canUse(ctx, "tasks.read")) {
    const result = await ctx.invokeTool("tasks.read", { limit: 50 });
    const tasks =
      (result.data as {
        title: string;
        status: string;
        priority: string;
        dueAt: string | null;
      }[]) ?? [];
    const open = tasks.filter(
      (t) => t.status === "open" || t.status === "in_progress",
    );
    const overdue = open.filter(
      (t) => t.dueAt !== null && new Date(t.dueAt) < new Date(),
    );
    sections.push({
      title: "Aufgaben",
      lines: [
        `${tasks.length} Aufgaben insgesamt, davon ${open.length} offen.`,
        `${overdue.length} davon überfällig.`,
        ...overdue
          .slice(0, 5)
          .map((t) => `Überfällig: ${t.title} (fällig ${t.dueAt!.slice(0, 10)})`),
      ],
    });
  }

  if (canUse(ctx, "activity.read")) {
    const result = await ctx.invokeTool("activity.read", { limit: 50 });
    const events =
      (result.data as { action: string; summary: string }[]) ?? [];
    const byAction = new Map<string, number>();
    for (const e of events) {
      byAction.set(e.action, (byAction.get(e.action) ?? 0) + 1);
    }
    sections.push({
      title: "Aktivität",
      lines: [
        `${events.length} protokollierte Ereignisse im betrachteten Zeitraum.`,
        ...[...byAction.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([action, n]) => `${action}: ${n}`),
      ],
    });
  }

  if (sections.length === 0) {
    return {
      summary:
        "Für diesen Bericht ist keine Datenquelle freigegeben. Es wurden keine Zahlen geschätzt.",
      output: { sections: [] },
    };
  }

  await ctx.recordStep("report", "Bericht aus Plattformdaten erstellt", {
    abschnitte: sections.length,
  });

  const body = sections
    .map((s) => `${s.title}\n${s.lines.map((l) => `- ${l}`).join("\n")}`)
    .join("\n\n");

  if (canUse(ctx, "briefing.write")) {
    await ctx.prepareAction({
      actionType: "briefing.create",
      title: `Bericht: ${ctx.capability.name}`,
      reasoning:
        "Alle Angaben stammen aus den Datensätzen dieser Organisation, nicht aus einer Schätzung.",
      riskLevel: "low",
      payload: { title: `Bericht: ${ctx.capability.name}`, body },
    });
  }

  return {
    summary:
      `Bericht aus ${sections.length} Datenquelle(n) erstellt — alle Zahlen stammen aus tatsächlichen Datensätzen.` +
      (missing.length > 0
        ? ` ${missing.length} weitere Quelle(n) sind nicht verbunden und fehlen im Bericht.`
        : ""),
    output: { sections, body, unavailableTools: missing },
  };
};

/* ========================================================================== */
/* checklist — Aufgabenliste erzeugen, Ausführung bleibt beim Menschen        */
/* ========================================================================== */

const checklistHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  await noteUnavailableTools(ctx);
  const result = await ctx.ai(
    "tasks.extract",
    text.slice(0, MAX_INPUT_CHARS),
    roleContext(ctx),
  );

  if (result.tasks.length === 0) {
    return {
      summary:
        "Aus den Daten ließen sich keine konkreten Schritte ableiten — es wurden keine erfunden.",
      output: { tasks: [] },
    };
  }

  await ctx.recordStep("draft", `${result.tasks.length} Schritt(e) abgeleitet`);

  if (canUse(ctx, "tasks.write")) {
    for (const item of result.tasks.slice(0, 10)) {
      await ctx.prepareAction({
        actionType: "task.create",
        title: item.title,
        reasoning: `Abgeleitet aus den übergebenen Daten für "${ctx.capability.name}".`,
        riskLevel: "low",
        payload: {
          title: item.title,
          description: item.description,
          dueAt: item.dueDate,
          priority: item.priority,
          source: { runId: ctx.runId, capability: ctx.capability.key },
        },
      });
    }
  }

  return {
    summary: `${result.tasks.length} Schritt(e) abgeleitet.`,
    output: { tasks: result.tasks },
  };
};

/* ========================================================================== */
/* qa — Antwort ausschließlich mit Quellenbeleg                               */
/* ========================================================================== */

const qaHandler: CapabilityHandler = async (ctx) => {
  const question = String(ctx.input.question ?? ctx.input.text ?? "").trim();
  if (!question) return { summary: "Keine Frage übergeben." };

  if (!canUse(ctx, "knowledge.search")) {
    return {
      summary:
        "Für diese Fähigkeit ist keine Wissensquelle freigegeben — ohne Beleg wird keine Antwort erzeugt.",
    };
  }

  const searchResult = await ctx.invokeTool("knowledge.search", {
    query: question,
    limit: 5,
    requesterRole: (ctx.input.requesterRole as string) ?? null,
  });
  const hits =
    (searchResult.data as {
      chunkId: string;
      documentId: string;
      documentTitle: string;
      content: string;
    }[]) ?? [];

  if (hits.length === 0) {
    return {
      summary:
        "Für diese Frage liegt in den freigegebenen Quellen kein Beleg vor. Es wurde bewusst keine Antwort erfunden.",
      output: { answer: null, sources: [], confidence: "nicht_belegt" },
    };
  }

  const chunkBlock = hits
    .map((h) => `[[chunk:${h.chunkId}]] ${h.content}`)
    .join("\n\n");
  const answer = await ctx.ai("qa.answer", `Frage: ${question}\n\n${chunkBlock}`);

  // Halluzinationsschutz: nur tatsächlich gelieferte Chunk-IDs zählen als Quelle.
  const validIds = new Set(hits.map((h) => h.chunkId));
  const citedIds = answer.usedChunkIds.filter((id) => validIds.has(id));
  const sources = hits
    .filter((h) => citedIds.includes(h.chunkId))
    .map((h) => ({
      title: h.documentTitle,
      chunkId: h.chunkId,
      documentId: h.documentId,
    }));

  await ctx.recordStep("validate", "Quellenbindung geprüft", {
    zitierte_quellen: sources.length,
    verworfene_ids: answer.usedChunkIds.length - citedIds.length,
  });

  return {
    summary:
      sources.length > 0
        ? `Frage mit ${sources.length} Quelle(n) beantwortet (${answer.confidence}).`
        : 'Antwort ohne belegbare Quelle — als "nicht_belegt" gekennzeichnet.',
    output: {
      answer: answer.answer,
      sources,
      confidence: sources.length > 0 ? answer.confidence : "nicht_belegt",
    },
  };
};

/* ========================================================================== */

export const ARCHETYPE_HANDLERS: Record<CapabilityArchetype, CapabilityHandler> =
  {
    monitor: monitorHandler,
    classify: classifyHandler,
    extract: extractHandler,
    draft: draftHandler,
    summarize: summarizeHandler,
    report: reportHandler,
    checklist: checklistHandler,
    qa: qaHandler,
    // "analysis" ist die Rückfallebene, wenn kein Archetyp greift.
    analysis: monitorHandler,
  };

/**
 * Registriert für jede Katalogfähigkeit den Handler ihres Archetyps unter
 * `capability:<key>`. Agentenspezifische Handler (handlers-core.ts) haben in
 * `resolveHandler` weiterhin Vorrang; bereits registrierte
 * Fähigkeits-Handler werden nicht überschrieben.
 */
export function registerArchetypeHandlers(capabilityKeys: string[]): void {
  for (const key of new Set(capabilityKeys)) {
    registerHandler(
      `capability:${key}`,
      ARCHETYPE_HANDLERS[classifyCapability(key)],
      { overwrite: false },
    );
  }
}
