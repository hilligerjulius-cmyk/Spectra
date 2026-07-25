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

/**
 * Lädt die Fachdaten, die die Fähigkeit ausdrücklich lesen darf.
 *
 * Das ist die Brücke zwischen Werkzeugen und Handlern: Ein Werkzeug allein
 * bewirkt nichts, wenn kein Handler es aufruft. Statt in jedem Archetyp
 * einzeln zu entscheiden, welcher Datenbestand relevant ist, werden hier alle
 * freigegebenen Lesequellen abgefragt und als `<daten>`-Block übergeben.
 *
 * Der Block ist ausdrücklich als Daten gekennzeichnet — nie als Anweisung.
 * Fremde Inhalte (Tickettexte, Notizen) landen darin und dürfen das Verhalten
 * des Agenten nicht steuern.
 */
const DOMAIN_READ_TOOLS: { key: string; label: string; input: unknown }[] = [
  { key: "tickets.read", label: "Tickets", input: { limit: 15 } },
  { key: "crm.read", label: "CRM-Vorgänge", input: { limit: 15 } },
  { key: "contacts.read", label: "Kontakte", input: { limit: 15 } },
  { key: "deals.read", label: "Vorgänge", input: { limit: 15 } },
  { key: "hr.read", label: "Personal", input: { limit: 15, includeAbsences: true } },
  { key: "files.read", label: "Dateien", input: { limit: 15 } },
];

async function loadDomainContext(
  ctx: HandlerContext,
): Promise<{ block: string; sources: string[] } | null> {
  const parts: string[] = [];
  const sources: string[] = [];

  for (const source of DOMAIN_READ_TOOLS) {
    if (!canUse(ctx, source.key)) continue;
    try {
      const result = await ctx.invokeTool(source.key, source.input);
      parts.push(
        `${source.label}: ${result.summary}\n${JSON.stringify(result.data).slice(0, 4000)}`,
      );
      sources.push(source.key);
    } catch (err) {
      // Ein einzelner fehlgeschlagener Datenzugriff darf den Lauf nicht
      // beenden — er wird benannt und der Lauf arbeitet mit dem Rest weiter.
      await ctx.recordStep("retrieve", `Datenquelle ${source.key} nicht lesbar`, {
        grund: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (parts.length === 0) return null;
  await ctx.recordStep("retrieve", `${sources.length} Fachdatenquelle(n) gelesen`, {
    quellen: sources,
  });
  return { block: `<daten>\n${parts.join("\n\n")}\n</daten>`, sources };
}

/**
 * Holt echte Plattformkennzahlen, wenn die Fähigkeit sie braucht und
 * freigegeben hat. Gibt einen Textblock zurück, der in die Analyse einfließt —
 * damit beruhen Befunde auf tatsächlichen Zahlen und nicht allein auf dem
 * übergebenen Text.
 */
async function platformMetrics(ctx: HandlerContext): Promise<string | null> {
  if (!canUse(ctx, "reports.generate")) return null;
  const result = await ctx.invokeTool("reports.generate", {
    periodDays: Number(ctx.input.periodDays ?? 30),
  });
  const d = result.data as {
    periodDays: number;
    stats: { totalRuns: number; completedRuns: number; failedRuns: number; successRate: number };
    approvals: { pending: number; approvalRate: number };
    tasks: { open: number; overdue: number };
  };
  return [
    `Zeitraum: ${d.periodDays} Tage`,
    `Läufe: ${d.stats.totalRuns} (abgeschlossen ${d.stats.completedRuns}, fehlgeschlagen ${d.stats.failedRuns}, Erfolgsquote ${d.stats.successRate}%)`,
    `Freigaben offen: ${d.approvals.pending} (Zustimmungsquote ${d.approvals.approvalRate}%)`,
    `Aufgaben offen: ${d.tasks.open}, überfällig: ${d.tasks.overdue}`,
  ].join("\n");
}

const monitorHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  await noteUnavailableTools(ctx);
  await ctx.recordStep("retrieve", "Eingangsdaten übernommen", {
    zeichen: text.length,
  });

  const metrics = await platformMetrics(ctx);
  if (metrics) {
    await ctx.recordStep("retrieve", "Plattformkennzahlen abgerufen", {
      quelle: "reports.generate",
      hinweis: "Zahlen aus abgeschlossenen Läufen, keine Schätzung.",
    });
  }
  const domain = await loadDomainContext(ctx);

  const analysis = await ctx.ai(
    "generic.analysis",
    [
      metrics ? `<kennzahlen>\n${metrics}\n</kennzahlen>` : null,
      domain?.block ?? null,
      text.slice(0, MAX_INPUT_CHARS),
    ]
      .filter(Boolean)
      .join("\n\n"),
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
      basedOnPlatformMetrics: metrics !== null,
      dataSources: domain?.sources ?? [],
    },
  };
};

/* ========================================================================== */
/* classify — einordnen, priorisieren, Zuständigkeit vorschlagen              */
/* ========================================================================== */

const classifyHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  const missing = await noteUnavailableTools(ctx);
  const domain = await loadDomainContext(ctx);
  const result = await ctx.ai(
    "generic.classify",
    [domain?.block ?? null, text.slice(0, MAX_INPUT_CHARS)]
      .filter(Boolean)
      .join("\n\n"),
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

  /**
   * Einordnung ins Ticket zurückschreiben. Nur mit ausdrücklich übergebener
   * Referenz: Aus einem Klassifikationsergebnis lässt sich nicht ableiten,
   * welches Ticket gemeint war, und ein falsch beschriftetes Ticket landet beim
   * falschen Team.
   */
  let ticketUpdated = false;
  if (canUse(ctx, "tickets.write")) {
    const reference = ctx.input.ticketReference ?? ctx.input.reference;
    if (typeof reference === "string" && reference.trim().length > 1) {
      await ctx.prepareAction({
        actionType: "ticket.update",
        title: `Ticket ${reference} einordnen: ${result.category}`,
        reasoning: result.rationale,
        riskLevel: "low",
        payload: {
          reference: reference.trim(),
          category: result.category.slice(0, 60),
          priority: result.priority,
          assignedTeam: result.suggestedOwnerRole?.slice(0, 80) ?? null,
          status: "in_bearbeitung",
        },
        affectedData: { ticket: reference, kategorie: result.category },
      });
      ticketUpdated = true;
    } else {
      await ctx.recordStep("validate", "Kein Ticket zum Aktualisieren benannt", {
        hinweis:
          "Die Fähigkeit darf Tickets schreiben, aber es wurde keine ticketReference übergeben. Es wurde keine geraten.",
      });
    }
  }

  // Eskalation bis zum Anhalten eines Agenten: nur mit ausdrücklich benanntem
  // Ziel. Welcher Agent gestoppt werden soll, wird nicht erraten — ein falsch
  // gestoppter Agent unterbricht Arbeitsabläufe.
  let pausePrepared = false;
  if (canUse(ctx, "agents.pause")) {
    const targetSlug = ctx.input.targetSlug;
    if (typeof targetSlug === "string" && targetSlug.trim().length > 1) {
      if (result.priority === "urgent") {
        await ctx.prepareAction({
          actionType: "agent.pause",
          title: `Agenten anhalten: ${targetSlug}`,
          reasoning: `Einordnung ergab höchste Dringlichkeit (${result.rationale}). Das Anhalten wirkt erst nach menschlicher Freigabe.`,
          riskLevel: "medium",
          payload: {
            targetSlug: targetSlug.trim(),
            reason: `Eskalation durch ${ctx.instance.displayName}: ${result.rationale}`.slice(
              0,
              500,
            ),
          },
          affectedData: { ziel: targetSlug, einordnung: result.category },
        });
        pausePrepared = true;
      }
    } else {
      await ctx.recordStep("validate", "Kein Agent zum Anhalten benannt", {
        hinweis:
          "Die Fähigkeit darf Agenten anhalten, aber es wurde kein targetSlug übergeben. Es wurde keiner geraten.",
      });
    }
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
      (ticketUpdated ? " Ticket-Einordnung vorgelegt." : "") +
      (pausePrepared ? " Anhalten eines Agenten zur Freigabe vorgelegt." : "") +
      (missing.length > 0
        ? ` Hinweis: ${missing.length} benötigte Anbindung(en) fehlen.`
        : ""),
    output: {
      ...result,
      ticketUpdatePrepared: ticketUpdated,
      pausePrepared,
      dataSources: domain?.sources ?? [],
      unavailableTools: missing,
    },
  };
};

/* ========================================================================== */
/* extract — Felder herausziehen und Lücken benennen                          */
/* ========================================================================== */

const extractHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  const missing = await noteUnavailableTools(ctx);
  const domain = await loadDomainContext(ctx);
  const result = await ctx.ai(
    "generic.extract",
    [domain?.block ?? null, text.slice(0, MAX_INPUT_CHARS)]
      .filter(Boolean)
      .join("\n\n"),
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

  // Dokumentverarbeitung: Das Extraktionsergebnis gehört in die Wissensbasis,
  // wenn die Fähigkeit das vorsieht — sonst ist der Lauf nach seinem Ende weg.
  const persisted =
    result.fields.length > 0
      ? await persistToKnowledge(ctx, {
          title: knowledgeTitle(ctx),
          body: [
            "Erfasste Angaben:",
            ...result.fields.map((f) => `- ${f.name}: ${f.value}`),
            ...(result.missingFields.length > 0
              ? ["", `Nicht im Dokument enthalten: ${result.missingFields.join(", ")}`]
              : []),
          ].join("\n"),
          reasoning:
            "Aus dem übergebenen Dokument erfasste Angaben. Fehlende Felder sind als fehlend vermerkt und nicht ergänzt.",
        })
      : false;

  return {
    summary:
      (result.fields.length > 0
        ? `${result.fields.length} Feld(er) extrahiert${result.missingFields.length > 0 ? `, ${result.missingFields.length} fehlen` : ""}.`
        : "Keine verwertbaren Felder gefunden — es wurde nichts ergänzt.") +
      (persisted ? " Wissenseintrag vorbereitet." : ""),
    output: {
      ...result,
      knowledgeEntryPrepared: persisted,
      dataSources: domain?.sources ?? [],
      unavailableTools: missing,
    },
  };
};

/* ========================================================================== */
/* draft — Entwurf erstellen, nie ungeprüft versenden                         */
/* ========================================================================== */

/**
 * Rechnet Positionen, wenn welche übergeben wurden. Bewusst getrennt vom
 * Modell: Beträge entstehen durch Arithmetik, nicht durch Textvorhersage.
 * Ohne verwertbare Positionen wird nichts gerechnet und nichts geschätzt.
 */
async function calculatePricing(
  ctx: HandlerContext,
): Promise<{ block: string; data: unknown } | null> {
  if (!canUse(ctx, "pricing.calculate")) return null;
  const raw = ctx.input.items;
  if (!Array.isArray(raw) || raw.length === 0) {
    await ctx.recordStep("validate", "Keine Preisberechnung möglich", {
      grund:
        "Es wurden keine Positionen übergeben. Beträge werden nicht geschätzt oder erfunden.",
    });
    return null;
  }

  try {
    const result = await ctx.invokeTool("pricing.calculate", {
      items: raw,
      totalDiscountPercent: Number(ctx.input.totalDiscountPercent ?? 0),
      vatPercent: Number(ctx.input.vatPercent ?? 19),
      currency: ctx.input.currency === "CHF" ? "CHF" : "EUR",
    });
    const d = result.data as {
      items: { description: string; quantity: number; lineTotalCents: number }[];
      netCents: number;
      vatPercent: number;
      vatCents: number;
      grossCents: number;
      currency: string;
      note: string;
    };
    const euro = (c: number) => `${(c / 100).toFixed(2)} ${d.currency}`;
    return {
      block: [
        "Positionen:",
        ...d.items.map(
          (i) => `- ${i.description} (${i.quantity} ×) = ${euro(i.lineTotalCents)}`,
        ),
        `Netto: ${euro(d.netCents)}`,
        `USt ${d.vatPercent}%: ${euro(d.vatCents)}`,
        `Brutto: ${euro(d.grossCents)}`,
        d.note,
      ].join("\n"),
      data: d,
    };
  } catch (err) {
    // Eine fehlgeschlagene Validierung ist hier ein gutes Ergebnis: sie
    // verhindert einen Entwurf mit erfundenen Zahlen.
    await ctx.recordStep("validate", "Preisberechnung abgelehnt", {
      grund: err instanceof Error ? err.message : String(err),
      hinweis: "Der Entwurf entsteht ohne Beträge.",
    });
    return null;
  }
}

const draftHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  const missing = await noteUnavailableTools(ctx);

  const pricing = await calculatePricing(ctx);
  const domain = await loadDomainContext(ctx);

  const draft = await ctx.ai(
    "generic.draft",
    [
      pricing ? `<berechnete_positionen>\n${pricing.block}\n</berechnete_positionen>` : null,
      domain?.block ?? null,
      text.slice(0, MAX_INPUT_CHARS),
    ]
      .filter(Boolean)
      .join("\n\n"),
    roleContext(ctx),
  );

  await ctx.recordStep("draft", "Entwurf erstellt", {
    offene_punkte: draft.openQuestions.length,
    beträge_berechnet: pricing !== null,
  });

  // Der Entwurfstext, ggf. mit den gerechneten Beträgen darunter.
  const body = pricing ? `${draft.body}\n\n${pricing.block}` : draft.body;

  // Wo die Fähigkeit ein Dokument vorsieht, entsteht ein Dokumententwurf —
  // das ist das Arbeitsergebnis, nicht eine Aufgabe mit Text im Beschreibungsfeld.
  const asDocument = await persistAsDocument(ctx, {
    title: draft.title,
    body,
    documentType: ctx.capability.key,
    // Der Entwurf erbt das Risiko der Fähigkeit: bei "hoch" (Angebot,
    // HR-Dokument) entscheidet ein Mensch, ob das Dokument entsteht.
    riskLevel: ctx.capability.riskLevel,
    reasoning:
      draft.openQuestions.length > 0
        ? `Vor Verwendung zu klären: ${draft.openQuestions.join("; ")}`
        : "Entwurf ausschließlich auf Basis der übergebenen Daten erstellt.",
  });

  // Wissenssicherung, wenn die Fähigkeit sie vorsieht (z. B. SOP, Hilfeartikel).
  const asKnowledge = await persistToKnowledge(ctx, {
    title: draft.title,
    body,
    reasoning:
      "Entwurf zur Aufnahme in die Wissensbasis. Wird als agentengeschrieben gekennzeichnet.",
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
  } else if (!asDocument && !asKnowledge && canUse(ctx, "tasks.write")) {
    // Letzte Rückfallebene: Ohne Versandkanal, Dokument und Wissensablage
    // wäre der Entwurf sonst nur im Lauf sichtbar.
    await ctx.prepareAction({
      actionType: "task.create",
      title: `Entwurf prüfen: ${draft.title}`,
      reasoning:
        "Für diese Fähigkeit ist kein Versandkanal und keine Ablage freigegeben — der Entwurf wird zur menschlichen Prüfung als Aufgabe hinterlegt.",
      riskLevel: "low",
      payload: {
        title: `Entwurf prüfen: ${draft.title}`.slice(0, 200),
        description: `${body}\n\nOffene Punkte: ${draft.openQuestions.join("; ") || "keine"}`,
        priority: "normal",
        source: { runId: ctx.runId, capability: ctx.capability.key },
      },
    });
  }

  const ablage = [
    asDocument ? "Dokumententwurf" : null,
    asKnowledge ? "Wissenseintrag" : null,
  ].filter(Boolean);

  return {
    summary:
      `Entwurf "${draft.title}" erstellt${draft.openQuestions.length > 0 ? ` — ${draft.openQuestions.length} offene(r) Punkt(e)` : ""}.` +
      (pricing ? " Beträge wurden gerechnet, nicht geschätzt." : "") +
      (ablage.length > 0 ? ` Vorbereitet: ${ablage.join(" und ")}.` : "") +
      (missing.length > 0 ? ` Nicht verbunden: ${missing.join(", ")}.` : ""),
    output: {
      ...draft,
      body,
      pricing: pricing?.data ?? null,
      documentPrepared: asDocument,
      knowledgeEntryPrepared: asKnowledge,
      dataSources: domain?.sources ?? [],
      unavailableTools: missing,
    },
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
  const domain = await loadDomainContext(ctx);
  const result = await ctx.ai(
    "text.summarize",
    [domain?.block ?? null, text.slice(0, MAX_INPUT_CHARS)]
      .filter(Boolean)
      .join("\n\n"),
    roleContext(ctx),
  );

  // Wissenssicherung: Die Verdichtung wird in die Wissensbasis übernommen,
  // wenn die Fähigkeit das ausdrücklich vorsieht. Der Eintrag entsteht über
  // prepareAction, damit die Automatisierungsstufe darüber entscheidet.
  const persisted = await persistToKnowledge(ctx, {
    title: knowledgeTitle(ctx),
    body: [
      result.summary,
      "",
      "Kernpunkte:",
      ...result.keyPoints.map((p) => `- ${p}`),
    ].join("\n"),
    reasoning:
      "Verdichtung des übergebenen Inhalts. Es wurden keine Angaben ergänzt, die nicht im Ausgangstext stehen.",
  });

  return {
    summary:
      result.summary + (persisted ? " Eintrag für die Wissensbasis vorbereitet." : ""),
    output: {
      summary: result.summary,
      keyPoints: result.keyPoints,
      knowledgeEntryPrepared: persisted,
      dataSources: domain?.sources ?? [],
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Gemeinsame Bausteine für schreibende Plattform-Werkzeuge                    */
/* -------------------------------------------------------------------------- */

function knowledgeTitle(ctx: HandlerContext): string {
  const given = ctx.input.title;
  if (typeof given === "string" && given.trim().length >= 3) {
    return given.trim().slice(0, 200);
  }
  const date = new Date().toISOString().slice(0, 10);
  return `${ctx.capability.name} — ${date}`;
}

/**
 * Legt einen Wissenseintrag zur Freigabe vor. Rückgabe sagt, ob das überhaupt
 * möglich war — der Aufrufer soll das im Ergebnis benennen, statt zu schweigen.
 *
 * Der Zugriffsbereich wird vom Ausgangsdokument nicht geerbt: Ein Agent, der
 * aus einem eingeschränkten Dokument zusammenfasst, würde den Inhalt sonst
 * unbemerkt für die ganze Organisation öffnen. Wer den Bereich einschränken
 * will, übergibt ihn ausdrücklich.
 */
async function persistToKnowledge(
  ctx: HandlerContext,
  entry: { title: string; body: string; reasoning: string },
): Promise<boolean> {
  if (!canUse(ctx, "knowledge.write")) return false;
  if (entry.body.trim().length < 30) return false;

  const scope = ctx.input.accessScope === "restricted" ? "restricted" : "organization";
  const roles = Array.isArray(ctx.input.allowedRoles)
    ? (ctx.input.allowedRoles as unknown[]).filter(
        (r): r is string => typeof r === "string",
      )
    : [];
  if (scope === "restricted" && roles.length === 0) {
    await ctx.recordStep("validate", "Wissenseintrag nicht vorbereitet", {
      grund:
        'accessScope "restricted" ohne allowedRoles wäre für niemanden lesbar — es wurde nichts geschrieben.',
    });
    return false;
  }

  await ctx.prepareAction({
    actionType: "knowledge.create",
    title: `Wissenseintrag: ${entry.title}`,
    reasoning: entry.reasoning,
    riskLevel: "low",
    payload: {
      title: entry.title,
      content: entry.body,
      accessScope: scope,
      allowedRoles: roles,
    },
    affectedData: { zugriff: scope, rollen: roles },
  });
  return true;
}

/** Legt einen Dokumententwurf zur Freigabe vor. */
async function persistAsDocument(
  ctx: HandlerContext,
  entry: {
    title: string;
    body: string;
    reasoning: string;
    documentType: string;
    riskLevel: "low" | "medium" | "high";
  },
): Promise<boolean> {
  if (!canUse(ctx, "documents.write")) return false;
  if (entry.body.trim().length < 30) return false;

  await ctx.prepareAction({
    actionType: "document.create",
    title: `Dokument: ${entry.title}`,
    reasoning: entry.reasoning,
    riskLevel: entry.riskLevel,
    payload: {
      title: entry.title,
      content: entry.body,
      documentType: entry.documentType,
      accessScope: "organization",
      allowedRoles: [],
    },
  });
  return true;
}

/* ========================================================================== */
/* report — Bericht aus tatsächlichen Plattformdaten                          */
/* ========================================================================== */

const reportHandler: CapabilityHandler = async (ctx) => {
  const missing = await noteUnavailableTools(ctx);
  const sections: { title: string; lines: string[] }[] = [];

  // Plattformkennzahlen aus echten Laufdaten. Steht bewusst zuerst: das ist
  // die belastbarste Quelle, weil sie aus abgeschlossenen Läufen stammt.
  if (canUse(ctx, "reports.generate")) {
    const result = await ctx.invokeTool("reports.generate", {
      periodDays: Number(ctx.input.periodDays ?? 30),
    });
    const data = result.data as {
      periodDays: number;
      stats: {
        totalRuns: number;
        completedRuns: number;
        failedRuns: number;
        successRate: number;
        totalCostDeciCents: number;
      };
      approvals: { pending: number; approvalRate: number };
      tasks: { open: number; overdue: number };
      topAgents: { displayName: string; runs: number; successRate: number }[];
      estimatedMinutesSaved: number;
      costsAreZeroBecauseScripted: boolean;
    };
    sections.push({
      title: `Kennzahlen (${data.periodDays} Tage)`,
      lines: [
        `${data.stats.totalRuns} Läufe, ${data.stats.completedRuns} abgeschlossen, ${data.stats.failedRuns} fehlgeschlagen (Erfolgsquote ${data.stats.successRate}%).`,
        `${data.approvals.pending} Freigabe(n) offen, Zustimmungsquote ${data.approvals.approvalRate}%.`,
        `${data.tasks.open} Aufgaben offen, davon ${data.tasks.overdue} überfällig.`,
        // Der Schätzcharakter wird mitgeschrieben, nicht weggelassen.
        `Geschätzte Zeitersparnis: ${data.estimatedMinutesSaved} Minuten (Schätzung anhand eines festen Minutenwerts je Lauf, keine Messung).`,
        data.costsAreZeroBecauseScripted
          ? "KI-Kosten: 0 — es läuft kein echter KI-Anbieter, nicht weil keine Kosten entstanden."
          : `KI-Kosten: ${(data.stats.totalCostDeciCents / 1000).toFixed(2)} €.`,
        ...data.topAgents
          .slice(0, 3)
          .map((a) => `Aktivster Agent: ${a.displayName} — ${a.runs} Läufe (${a.successRate}%).`),
      ],
    });
  }

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

  // Tickets: echte Servicekennzahlen aus dem eigenen Bestand.
  if (canUse(ctx, "tickets.read")) {
    const result = await ctx.invokeTool("tickets.read", { limit: 100 });
    const tickets =
      (result.data as {
        status: string;
        priority: string;
        overdue: boolean;
        satisfaction: number | null;
        firstResponseMinutes: number | null;
        resolutionMinutes: number | null;
      }[]) ?? [];
    const open = tickets.filter(
      (t) => t.status !== "geloest" && t.status !== "geschlossen",
    );
    const rated = tickets.filter((t) => t.satisfaction !== null);
    const responded = tickets.filter((t) => t.firstResponseMinutes !== null);
    sections.push({
      title: "Serviceanfragen",
      lines: [
        `${tickets.length} Ticket(s), davon ${open.length} offen und ${tickets.filter((t) => t.overdue).length} überfällig.`,
        `${open.filter((t) => t.priority === "urgent" || t.priority === "high").length} offene Ticket(s) mit hoher oder höchster Priorität.`,
        // Mittelwerte nur, wenn es überhaupt Messwerte gibt — sonst bliebe
        // eine Null stehen, die wie ein Ergebnis aussieht.
        responded.length > 0
          ? `Mittlere Zeit bis zur ersten Reaktion: ${Math.round(responded.reduce((s, t) => s + t.firstResponseMinutes!, 0) / responded.length)} Minuten (${responded.length} von ${tickets.length} Tickets).`
          : "Zeit bis zur ersten Reaktion: nicht ermittelbar, keine Reaktion erfasst.",
        rated.length > 0
          ? `Durchschnittliche Bewertung: ${(rated.reduce((s, t) => s + t.satisfaction!, 0) / rated.length).toFixed(1)} von 5 (${rated.length} Bewertung(en)).`
          : "Kundenzufriedenheit: nicht erhoben.",
      ],
    });
  }

  // CRM: Pipeline aus tatsächlichen Vorgängen.
  if (canUse(ctx, "crm.read")) {
    const result = await ctx.invokeTool("crm.read", { limit: 100 });
    const d = result.data as {
      deals: { stage: string; valueCents: number | null; daysSinceActivity: number | null }[];
      totalValueCents: number | null;
      totalValueNote: string | null;
    };
    const byStage = new Map<string, number>();
    for (const deal of d.deals) {
      byStage.set(deal.stage, (byStage.get(deal.stage) ?? 0) + 1);
    }
    const stale = d.deals.filter(
      (deal) => deal.daysSinceActivity !== null && deal.daysSinceActivity > 14,
    );
    sections.push({
      title: "Vertriebspipeline",
      lines: [
        `${d.deals.length} Vorgang/Vorgänge in der Pipeline.`,
        ...[...byStage.entries()].map(([stage, n]) => `${stage}: ${n}`),
        d.totalValueCents !== null
          ? `Gesamtwert: ${(d.totalValueCents / 100).toFixed(2)} EUR.`
          : (d.totalValueNote ?? "Gesamtwert nicht ausgewiesen."),
        `${stale.length} Vorgang/Vorgänge ohne Aktivität seit mehr als 14 Tagen.`,
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

  const reasoning =
    "Alle Angaben stammen aus den Datensätzen dieser Organisation. Wo eine Zahl geschätzt ist, steht das im Bericht.";
  let ablage: string | null = null;

  if (canUse(ctx, "briefing.write")) {
    await ctx.prepareAction({
      actionType: "briefing.create",
      title: `Bericht: ${ctx.capability.name}`,
      reasoning,
      riskLevel: "low",
      payload: { title: `Bericht: ${ctx.capability.name}`, body },
    });
    ablage = "Briefing";
  } else if (
    await persistAsDocument(ctx, {
      title: `Bericht: ${ctx.capability.name}`,
      body,
      documentType: "bericht",
      riskLevel: "low",
      reasoning,
    })
  ) {
    ablage = "Dokument";
  } else if (
    await persistToKnowledge(ctx, {
      title: `Bericht: ${ctx.capability.name}`,
      body,
      reasoning,
    })
  ) {
    ablage = "Wissenseintrag";
  }

  return {
    summary:
      `Bericht aus ${sections.length} Datenquelle(n) erstellt — alle Zahlen stammen aus tatsächlichen Datensätzen.` +
      (ablage ? ` Ablage als ${ablage} vorbereitet.` : "") +
      (missing.length > 0
        ? ` ${missing.length} weitere Quelle(n) sind nicht verbunden und fehlen im Bericht.`
        : ""),
    output: { sections, body, ablage, unavailableTools: missing },
  };
};

/* ========================================================================== */
/* checklist — Aufgabenliste erzeugen, Ausführung bleibt beim Menschen        */
/* ========================================================================== */

const checklistHandler: CapabilityHandler = async (ctx) => {
  const text = inputText(ctx);
  await noteUnavailableTools(ctx);
  const domain = await loadDomainContext(ctx);

  /**
   * Abwesenheitsanträge formal erfassen. Der Status bleibt „beantragt" — ein
   * Agent prüft die Form, entscheiden darf nur ein Mensch. Ohne vollständige,
   * plausible Antragsdaten wird nichts erfasst.
   */
  let absenceRecorded = false;
  if (canUse(ctx, "hr.write")) {
    const req = ctx.input.absenceRequest;
    if (req && typeof req === "object") {
      const r = req as Record<string, unknown>;
      const complete =
        typeof r.workEmail === "string" &&
        typeof r.startDate === "string" &&
        typeof r.endDate === "string" &&
        typeof r.workingDays === "number";
      if (complete) {
        await ctx.prepareAction({
          actionType: "absence.record",
          title: `Abwesenheitsantrag erfassen: ${r.workEmail}`,
          reasoning:
            'Formale Erfassung des Antrags. Der Status bleibt "beantragt" — die Entscheidung trifft ein Mensch.',
          riskLevel: "low",
          payload: {
            workEmail: r.workEmail,
            absence: {
              kind: typeof r.kind === "string" ? r.kind : "urlaub",
              startDate: r.startDate,
              endDate: r.endDate,
              workingDays: r.workingDays,
              note: typeof r.note === "string" ? r.note : null,
            },
            checkResult: { pruefung: "formal", durchByRun: ctx.runId },
          },
          affectedData: { person: r.workEmail, tage: r.workingDays },
        });
        absenceRecorded = true;
      } else {
        await ctx.recordStep("validate", "Antrag unvollständig — nicht erfasst", {
          benoetigt: ["workEmail", "startDate", "endDate", "workingDays"],
          hinweis: "Fehlende Angaben werden nicht ergänzt oder geschätzt.",
        });
      }
    }
  }

  const result = await ctx.ai(
    "tasks.extract",
    [domain?.block ?? null, text.slice(0, MAX_INPUT_CHARS)]
      .filter(Boolean)
      .join("\n\n"),
    roleContext(ctx),
  );

  // Erst ablegen, dann Schritte: Bei Fähigkeiten wie der Protokollindizierung
  // ist die Auffindbarkeit des Inhalts der Zweck — auch wenn sich daraus keine
  // einzige Aufgabe ergibt.
  const persisted =
    text.trim().length >= 30
      ? await persistToKnowledge(ctx, {
          title: knowledgeTitle(ctx),
          body: [
            text.slice(0, 20_000),
            ...(result.tasks.length > 0
              ? [
                  "",
                  "Abgeleitete Schritte:",
                  ...result.tasks.map((t) => `- ${t.title}`),
                ]
              : []),
          ].join("\n"),
          reasoning:
            "Inhalt wird für die Wiederauffindbarkeit in die Wissensbasis übernommen.",
        })
      : false;

  if (result.tasks.length === 0) {
    return {
      summary:
        "Aus den Daten ließen sich keine konkreten Schritte ableiten — es wurden keine erfunden." +
        (persisted ? " Der Inhalt wurde für die Wissensbasis vorbereitet." : "") +
        (absenceRecorded ? " Abwesenheitsantrag zur Erfassung vorgelegt." : ""),
      output: {
        tasks: [],
        knowledgeEntryPrepared: persisted,
        absenceRecordPrepared: absenceRecorded,
      },
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
    summary:
      `${result.tasks.length} Schritt(e) abgeleitet.` +
      (persisted ? " Wissenseintrag vorbereitet." : "") +
      (absenceRecorded ? " Abwesenheitsantrag zur Erfassung vorgelegt." : ""),
    output: {
      tasks: result.tasks,
      knowledgeEntryPrepared: persisted,
      absenceRecordPrepared: absenceRecorded,
      dataSources: domain?.sources ?? [],
    },
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
