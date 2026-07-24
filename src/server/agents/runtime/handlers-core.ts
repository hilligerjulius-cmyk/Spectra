import { registerHandler } from "./handlers";
import type { CapabilityHandler, HandlerContext } from "./engine";

/**
 * Vertiefte Capability-Handler (Phase 5/6).
 * Registrierungsschlüssel:
 *   "<definitionSlug>:<capabilityKey>" — nur für diesen Agenten
 *   "capability:<capabilityKey>"       — für alle Agenten mit dieser Fähigkeit
 */

/* ========================================================================== */
/* Task Agent — Aufgaben aus Text extrahieren                                 */
/* ========================================================================== */

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

/* ========================================================================== */
/* Email Triage Agent — Klassifizierung eingehender E-Mails                   */
/* ========================================================================== */

interface InboxEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string;
}

async function loadInboxOrInput(ctx: HandlerContext): Promise<InboxEmail[]> {
  // Manueller Lauf mit eingefügtem Text: als eine Pseudo-Mail behandeln
  const manual = String(ctx.input.text ?? "").trim();
  if (manual) {
    return [
      {
        id: String(ctx.input.emailId ?? "manuell"),
        from: String(ctx.input.from ?? "unbekannt@extern"),
        subject:
          manual.match(/^(?:Betreff|Subject):\s*(.+)$/im)?.[1]?.trim() ??
          "Manuell eingefügte Nachricht",
        body: manual,
        receivedAt: new Date().toISOString(),
      },
    ];
  }
  const result = await ctx.invokeTool("email.read", {
    onlyUntriaged: true,
    limit: 10,
  });
  return (result.data as InboxEmail[]) ?? [];
}

const emailClassifyHandler: CapabilityHandler = async (ctx) => {
  const emails = await loadInboxOrInput(ctx);
  if (emails.length === 0) {
    return { summary: "Keine untriagierte E-Mail im Posteingang." };
  }

  const classified: {
    id: string;
    subject: string;
    category: string;
    urgency: string;
    suspicious: boolean;
  }[] = [];

  for (const email of emails.slice(0, 5)) {
    // Prompt-Injection-Härtung: Inhalt wird als Datenblock übergeben, der
    // Systemprompt weist Anweisungen darin ausdrücklich zurück.
    const result = await ctx.ai(
      "email.classify",
      `Absender: ${email.from}\nBetreff: ${email.subject}\n\n${email.body}`,
    );
    classified.push({
      id: email.id,
      subject: email.subject,
      category: result.category,
      urgency: result.urgency,
      suspicious: result.suspicious,
    });

    if (email.id !== "manuell" && ctx.level >= 3) {
      // Klassifizierung ist eine risikoarme Metadaten-Aktion: ab Stufe 3
      // direkt anwenden (kein Löschen, kein Archivieren — Spec §11 B.1).
      await ctx.invokeTool("email.label", {
        emailId: email.id,
        category: result.category,
        urgency: result.urgency,
        suspicious: result.suspicious,
        deadlines: result.deadlines,
        labels: [result.category, result.urgency],
      });
    }

    if (result.suspicious || result.urgency === "kritisch") {
      await ctx.prepareAction({
        actionType: "notification.send",
        title: result.suspicious
          ? `Verdächtige E-Mail: ${email.subject}`
          : `Kritische E-Mail: ${email.subject}`,
        reasoning:
          result.suspicionReason ??
          `Die Nachricht von ${email.from} wurde als ${result.urgency} eingestuft und erfordert schnelle Aufmerksamkeit.`,
        payload: {
          type: result.suspicious ? "risk_detected" : "task_overdue",
          title: result.suspicious
            ? `Verdächtige E-Mail von ${email.from}`
            : `Dringende E-Mail: ${email.subject}`,
          body: result.summary,
          href: "/app/integrations",
        },
        affectedData: { emailId: email.id, absender: email.from },
        riskLevel: "low",
      });
    }
  }

  const urgent = classified.filter(
    (c) => c.urgency === "hoch" || c.urgency === "kritisch",
  ).length;
  const suspicious = classified.filter((c) => c.suspicious).length;
  return {
    summary: `${classified.length} E-Mail(s) klassifiziert — ${urgent} dringend, ${suspicious} verdächtig.`,
    output: { classified },
  };
};

registerHandler("email-triage:classify", emailClassifyHandler);

/** Email Triage — Fristen/Aufgaben aus E-Mails erkennen (Szenario 1). */
const emailDeadlineHandler: CapabilityHandler = async (ctx) => {
  const emails = await loadInboxOrInput(ctx);
  if (emails.length === 0) {
    return { summary: "Keine E-Mails zur Fristenprüfung vorhanden." };
  }
  const found: { emailId: string; deadlines: string[] }[] = [];
  for (const email of emails.slice(0, 5)) {
    const result = await ctx.ai(
      "email.classify",
      `Absender: ${email.from}\nBetreff: ${email.subject}\n\n${email.body}`,
    );
    if (result.deadlines.length > 0) {
      found.push({ emailId: email.id, deadlines: result.deadlines });
    }
  }
  return {
    summary:
      found.length > 0
        ? `In ${found.length} E-Mail(s) wurden Fristen erkannt: ${found.flatMap((f) => f.deadlines).join(", ")}.`
        : "Keine Fristen in den geprüften E-Mails erkannt.",
    output: { found },
  };
};

registerHandler("email-triage:deadline-extraction", emailDeadlineHandler);

/* ========================================================================== */
/* Meeting Preparation Agent — quellenbasiertes Briefing (Szenario 2)         */
/* ========================================================================== */

interface CalendarEventData {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  attendees: string[];
}

const meetingBriefingHandler: CapabilityHandler = async (ctx) => {
  const manual = String(ctx.input.text ?? "").trim();
  let events: CalendarEventData[] = [];

  if (!manual) {
    const calendarResult = await ctx.invokeTool("calendar.read", {
      withinHours: 72,
    });
    events = (calendarResult.data as CalendarEventData[]) ?? [];
    if (events.length === 0) {
      return {
        summary:
          "Keine anstehenden Termine in den nächsten 72 Stunden — kein Briefing erforderlich.",
      };
    }
  }

  const event = events[0];
  const context = manual
    ? manual
    : `Termin: ${event!.title}\nZeit: ${new Date(event!.startsAt).toLocaleString("de-DE")}\nOrt: ${event!.location ?? "nicht angegeben"}\nTeilnehmer: ${event!.attendees.join(", ") || "nicht angegeben"}\nBeschreibung: ${event!.description ?? "keine"}`;

  await ctx.recordStep(
    "retrieve",
    manual ? "Termindaten aus Eingabe übernommen" : `Termin "${event!.title}" geladen`,
  );

  // Quellenbasierte Anreicherung aus der Wissensbasis (rechtegeprüft)
  const searchTerm = manual.slice(0, 200) || event!.title;
  let knowledgeContext = "";
  const sources: { title: string; ref: string }[] = [];
  try {
    const knowledgeResult = await ctx.invokeTool("knowledge.search", {
      query: searchTerm,
      limit: 3,
      requesterRole: (ctx.input.requesterRole as string) ?? null,
    });
    const hits = (knowledgeResult.data as {
      chunkId: string;
      documentTitle: string;
      content: string;
    }[]) ?? [];
    for (const hit of hits) {
      knowledgeContext += `\n[[Quelle: ${hit.documentTitle}]] ${hit.content.slice(0, 600)}`;
      sources.push({ title: hit.documentTitle, ref: hit.chunkId });
    }
  } catch {
    // Wissensbasis nicht freigegeben oder leer — Briefing ohne Quellen erstellen
    await ctx.recordStep("retrieve", "Wissensbasis nicht verfügbar", {
      hinweis: "Briefing wird ohne Dokumentquellen erstellt.",
    });
  }

  const summary = await ctx.ai(
    "text.summarize",
    `${context}${knowledgeContext ? `\n\nBekanntes aus der Wissensbasis:${knowledgeContext}` : ""}`,
  );

  // Fehlende Informationen ausdrücklich kennzeichnen (Spec §11 A.7)
  const gaps: string[] = [];
  if (!manual) {
    if (!event!.description) gaps.push("Keine Agenda/Beschreibung im Termin hinterlegt");
    if (event!.attendees.length === 0) gaps.push("Keine Teilnehmerliste hinterlegt");
  }
  if (sources.length === 0) {
    gaps.push("Keine belegten Informationen aus der Wissensbasis gefunden");
  }

  const briefingBody = [
    `# Briefing: ${manual ? "Termin" : event!.title}`,
    "",
    manual
      ? ""
      : `**Wann:** ${new Date(event!.startsAt).toLocaleString("de-DE")} – ${new Date(event!.endsAt).toLocaleTimeString("de-DE")}`,
    manual ? "" : `**Ort:** ${event!.location ?? "nicht angegeben"}`,
    manual ? "" : `**Teilnehmer:** ${event!.attendees.join(", ") || "nicht angegeben"}`,
    "",
    "## Zusammenfassung",
    summary.summary,
    "",
    "## Wichtige Punkte",
    ...summary.keyPoints.map((p) => `- ${p}`),
    "",
    ...(sources.length > 0
      ? ["## Quellen", ...sources.map((s) => `- ${s.title}`), ""]
      : []),
    ...(gaps.length > 0
      ? ["## Offene Punkte / fehlende Informationen", ...gaps.map((g) => `- ${g}`)]
      : []),
  ]
    .filter((l) => l !== "")
    .join("\n");

  await ctx.recordStep("draft", "Briefing formuliert", {
    quellen: sources.length,
    luecken: gaps.length,
  });

  const outcome = await ctx.prepareAction({
    actionType: "briefing.create",
    title: `Briefing: ${manual ? "Termin" : event!.title}`,
    reasoning: `Für den anstehenden Termin wurde ein quellenbasiertes Briefing erstellt${sources.length > 0 ? ` (${sources.length} Quellen)` : " (keine Dokumentquellen verfügbar)"}.`,
    payload: {
      title: `Briefing: ${manual ? "Termin" : event!.title}`,
      content: briefingBody,
      relatedEventId: manual ? null : event!.id,
    },
    affectedData: { quellen: sources, fehlend: gaps },
    riskLevel: "low",
  });

  return {
    summary: `Briefing erstellt${sources.length > 0 ? ` mit ${sources.length} Quelle(n)` : " (ohne Dokumentquellen)"}${gaps.length > 0 ? `, ${gaps.length} offene Punkt(e) gekennzeichnet` : ""}${outcome.mode === "approval_requested" ? " — wartet auf Freigabe" : ""}.`,
    output: { briefing: briefingBody, sources, gaps },
  };
};

registerHandler("meeting-preparation:meeting-briefing", meetingBriefingHandler);

/* ========================================================================== */
/* Follow-up Agent — offene Angebote erkennen und nachfassen (Szenario 3)     */
/* ========================================================================== */

interface StaleDeal {
  id: string;
  name: string;
  company: string;
  contactEmail: string;
  valueCents: number | null;
  proposalSentAt: string | null;
  notes: string | null;
}

const opportunityWatchHandler: CapabilityHandler = async (ctx) => {
  const result = await ctx.invokeTool("deals.read", {
    staleAfterDays: Number(ctx.input.staleAfterDays ?? 7),
    limit: 20,
  });
  const stale = (result.data as StaleDeal[]) ?? [];
  if (stale.length === 0) {
    return { summary: "Keine offenen Angebote ohne Reaktion — nichts zu tun." };
  }
  const totalValue = stale.reduce((sum, d) => sum + (d.valueCents ?? 0), 0);
  return {
    summary: `${stale.length} offene(s) Angebot(e) ohne Reaktion, Gesamtwert ${(totalValue / 100).toLocaleString("de-DE")} €.`,
    output: { stale },
  };
};

registerHandler("follow-up:opportunity-watch", opportunityWatchHandler);

const followupDraftingHandler: CapabilityHandler = async (ctx) => {
  const result = await ctx.invokeTool("deals.read", {
    staleAfterDays: Number(ctx.input.staleAfterDays ?? 7),
    limit: 10,
  });
  const stale = (result.data as StaleDeal[]) ?? [];
  if (stale.length === 0) {
    return { summary: "Keine offenen Angebote ohne Reaktion — keine Entwürfe nötig." };
  }

  const drafts: { dealId: string; subject: string }[] = [];
  for (const d of stale.slice(0, 3)) {
    const daysSince = d.proposalSentAt
      ? Math.floor(
          (Date.now() - new Date(d.proposalSentAt).getTime()) / (24 * 60 * 60 * 1000),
        )
      : null;
    const draft = await ctx.ai(
      "followup.draft",
      `Deal: ${d.name}\nUnternehmen: ${d.company}\nAngebotswert: ${d.valueCents != null ? (d.valueCents / 100).toLocaleString("de-DE") + " €" : "unbekannt"}\nAngebot versendet: ${d.proposalSentAt ? new Date(d.proposalSentAt).toLocaleDateString("de-DE") : "unbekannt"}${daysSince != null ? ` (vor ${daysSince} Tagen)` : ""}\nNotizen: ${d.notes ?? "keine"}`,
    );

    await ctx.recordStep("draft", `Follow-up für ${d.company} formuliert`, {
      deal: d.name,
    });

    // Versand ist eine hochriskante Aktion → immer Freigabe (Spec §11 A.4)
    const outcome = await ctx.prepareAction({
      actionType: "email.send",
      title: `Follow-up an ${d.company} senden`,
      reasoning: draft.rationale,
      payload: {
        to: d.contactEmail,
        subject: draft.subject,
        body: draft.body,
        dealId: d.id,
      },
      affectedData: {
        deal: d.name,
        unternehmen: d.company,
        angebotswert:
          d.valueCents != null ? `${(d.valueCents / 100).toLocaleString("de-DE")} €` : null,
        tageOhneAntwort: daysSince,
      },
      riskLevel: "high",
    });
    drafts.push({ dealId: d.id, subject: draft.subject });
    if (outcome.mode === "drafted") {
      // Auf Stufe ≤2 zusätzlich als Entwurf im Postfach ablegen
      if (ctx.instance.allowedTools.includes("email.draft") && ctx.level === 2) {
        await ctx.invokeTool("email.draft", {
          to: d.contactEmail,
          subject: draft.subject,
          body: draft.body,
        });
      }
    }
  }

  return {
    summary: `${drafts.length} Follow-up-Entwurf/-Entwürfe erstellt für ${stale.length} offene(s) Angebot(e).`,
    output: { drafts },
  };
};

registerHandler("follow-up:followup-drafting", followupDraftingHandler);

/* ========================================================================== */
/* Company Memory Agent — quellenbasierte Antworten (Szenario 4)              */
/* ========================================================================== */

const qaWithSourcesHandler: CapabilityHandler = async (ctx) => {
  const question = String(ctx.input.question ?? ctx.input.text ?? "").trim();
  if (!question) {
    return { summary: "Keine Frage übergeben." };
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
      output: {
        answer:
          "Für diese Frage liegt in den für Sie freigegebenen Dokumenten kein Beleg vor.",
        sources: [],
        confidence: "nicht_belegt",
      },
    };
  }

  // Chunks im maschinenlesbaren Format übergeben; der Provider zitiert IDs.
  const chunkBlock = hits
    .map((h) => `[[chunk:${h.chunkId}]] ${h.content}`)
    .join("\n\n");
  const answer = await ctx.ai("qa.answer", `Frage: ${question}\n\n${chunkBlock}`);

  // Halluzinationsschutz: nur tatsächlich gelieferte Chunk-IDs als Quellen führen
  const validIds = new Set(hits.map((h) => h.chunkId));
  const citedIds = answer.usedChunkIds.filter((id) => validIds.has(id));
  const sources = hits
    .filter((h) => citedIds.includes(h.chunkId))
    .map((h) => ({ title: h.documentTitle, chunkId: h.chunkId, documentId: h.documentId }));

  await ctx.recordStep("validate", "Quellenbindung geprüft", {
    zitierte_quellen: sources.length,
    verworfene_ids: answer.usedChunkIds.length - citedIds.length,
    konfidenz: answer.confidence,
  });

  return {
    summary:
      sources.length > 0
        ? `Frage beantwortet mit ${sources.length} Quelle(n) (${answer.confidence}).`
        : `Antwort ohne belegbare Quelle — als "${answer.confidence}" gekennzeichnet.`,
    output: {
      answer: answer.answer,
      sources,
      confidence: sources.length > 0 ? answer.confidence : "nicht_belegt",
    },
  };
};

registerHandler("company-memory:qa-with-sources", qaWithSourcesHandler);

/* ========================================================================== */
/* Invoice Intake Agent — Rechnungsdaten extrahieren (Szenario 5)             */
/* ========================================================================== */

const invoiceExtractionHandler: CapabilityHandler = async (ctx) => {
  const text = String(ctx.input.text ?? "").trim();
  if (!text) {
    return {
      summary:
        "Kein Rechnungsdokument übergeben. Bitte Rechnung hochladen oder Text einfügen.",
    };
  }
  await ctx.recordStep("retrieve", "Rechnungsdokument übernommen", {
    zeichen: text.length,
  });

  const extraction = await ctx.ai("invoice.extract", text);

  // Dublettenprüfung gegen bereits erfasste Vorgänge
  let duplicateTaskId: string | null = null;
  if (ctx.instance.allowedTools.includes("finance.read")) {
    try {
      const dupResult = await ctx.invokeTool("finance.read", {
        invoiceNumber: extraction.invoiceNumber,
      });
      duplicateTaskId =
        (dupResult.data as { duplicateTaskId: string | null })?.duplicateTaskId ?? null;
    } catch {
      // Dublettenprüfung optional — Lauf läuft weiter
    }
  }

  await ctx.recordStep("validate", "Pflichtfelder geprüft", {
    fehlende_felder: extraction.missingFields,
    dublette: duplicateTaskId,
  });

  // Bei fehlenden Pflichtfeldern oder Dubletten: Prüfaufgabe erstellen.
  // Es erfolgt bewusst KEINE Zahlung und KEINE Buchung (Spec §11 C.1).
  const needsReview = extraction.missingFields.length > 0 || duplicateTaskId != null;
  const title = needsReview
    ? `Rechnung prüfen: ${extraction.vendorName ?? "unbekannter Lieferant"} (${extraction.invoiceNumber ?? "ohne Nummer"})`
    : `Rechnung erfasst: ${extraction.vendorName ?? "unbekannter Lieferant"} (${extraction.invoiceNumber ?? "ohne Nummer"})`;

  const description = [
    `Lieferant: ${extraction.vendorName ?? "— fehlt —"}`,
    `Rechnungsnummer: ${extraction.invoiceNumber ?? "— fehlt —"}`,
    `Betrag: ${extraction.totalAmountCents != null ? (extraction.totalAmountCents / 100).toLocaleString("de-DE", { style: "currency", currency: extraction.currency ?? "EUR" }) : "— fehlt —"}`,
    `Rechnungsdatum: ${extraction.invoiceDate ?? "— fehlt —"}`,
    `Fällig: ${extraction.dueDate ?? "— nicht angegeben —"}`,
    extraction.iban ? `IBAN: ${extraction.iban}` : null,
    "",
    extraction.missingFields.length > 0
      ? `**Fehlende Pflichtfelder:** ${extraction.missingFields.join(", ")}`
      : "Alle geprüften Pflichtfelder vorhanden.",
    duplicateTaskId ? `**Achtung:** Mögliche Dublette (Vorgang ${duplicateTaskId}).` : null,
    "",
    "_Hinweis: Es wurde keine Zahlung ausgelöst und keine Buchung vorgenommen. Die abschließende Prüfung und Freigabe erfolgt durch einen Menschen._",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const outcome = await ctx.prepareAction({
    actionType: "task.create",
    title,
    reasoning: needsReview
      ? `Die Rechnung ist unvollständig oder verdächtig (${[...extraction.missingFields, duplicateTaskId ? "mögliche Dublette" : ""].filter(Boolean).join(", ")}) und benötigt eine menschliche Prüfung.`
      : "Die Rechnungsdaten wurden vollständig extrahiert und werden zur Kontrolle als Vorgang angelegt.",
    payload: {
      title,
      description,
      priority: needsReview ? "high" : "normal",
      dueAt: extraction.dueDate,
      source: {
        type: "invoice",
        invoiceNumber: extraction.invoiceNumber,
        vendorName: extraction.vendorName,
        totalAmountCents: extraction.totalAmountCents,
      },
    },
    affectedData: {
      extrahiert: extraction,
      moegliche_dublette: duplicateTaskId,
    },
    riskLevel: needsReview ? "medium" : "low",
  });

  return {
    summary: needsReview
      ? `Rechnung unvollständig (${extraction.missingFields.join(", ") || "Dublettenverdacht"}) — Prüfaufgabe ${outcome.mode === "approval_requested" ? "zur Freigabe vorgelegt" : "erstellt"}. Keine Zahlung, keine Buchung.`
      : `Rechnungsdaten extrahiert (${extraction.invoiceNumber ?? "ohne Nummer"}) — Vorgang ${outcome.mode === "approval_requested" ? "zur Freigabe vorgelegt" : "erstellt"}. Keine Zahlung, keine Buchung.`,
    output: { extraction, duplicateTaskId, needsReview },
  };
};

registerHandler("invoice-intake:invoice-extraction", invoiceExtractionHandler);
registerHandler("invoice-intake:field-check", invoiceExtractionHandler);

/* ========================================================================== */
/* Chief of Staff — Tagesbriefing und Koordination                            */
/* ========================================================================== */

const dailyBriefingHandler: CapabilityHandler = async (ctx) => {
  const tasksResult = await ctx.invokeTool("tasks.read", {
    status: ["open", "in_progress"],
    limit: 30,
  });
  const openTasks =
    (tasksResult.data as {
      id: string;
      title: string;
      status: string;
      priority: string;
      dueAt: string | null;
    }[]) ?? [];

  const activityResult = await ctx.invokeTool("activity.read", { limit: 20 });
  const activity =
    (activityResult.data as { action: string; summary: string }[]) ?? [];

  const now = Date.now();
  const overdue = openTasks.filter(
    (t) => t.dueAt && new Date(t.dueAt).getTime() < now,
  );
  const dueSoon = openTasks.filter((t) => {
    if (!t.dueAt) return false;
    const due = new Date(t.dueAt).getTime();
    return due >= now && due <= now + 3 * 24 * 60 * 60 * 1000;
  });
  const urgent = openTasks.filter(
    (t) => t.priority === "urgent" || t.priority === "high",
  );
  const failedRuns = activity.filter((a) => a.action.includes("failed"));
  const pendingApprovalRuns = activity.filter((a) =>
    a.action.includes("waiting_approval"),
  );

  await ctx.recordStep("reason", "Lage bewertet", {
    offene_aufgaben: openTasks.length,
    ueberfaellig: overdue.length,
    faellig_bald: dueSoon.length,
    fehlgeschlagene_laeufe: failedRuns.length,
  });

  const briefing = [
    `# Tagesbriefing ${new Date().toLocaleDateString("de-DE")}`,
    "",
    "## Heutige Prioritäten",
    ...(urgent.length > 0
      ? urgent.slice(0, 5).map((t) => `- ${t.title} (${t.priority})`)
      : ["- Keine hoch priorisierten Aufgaben offen."]),
    "",
    "## Risiken",
    ...(overdue.length > 0
      ? overdue.slice(0, 5).map((t) => `- Überfällig: ${t.title}`)
      : ["- Keine überfälligen Aufgaben."]),
    ...(failedRuns.length > 0
      ? [`- ${failedRuns.length} fehlgeschlagene(r) Agentenlauf/-läufe`]
      : []),
    "",
    "## Anstehend (nächste 3 Tage)",
    ...(dueSoon.length > 0
      ? dueSoon.slice(0, 5).map((t) => `- ${t.title} (fällig ${new Date(t.dueAt!).toLocaleDateString("de-DE")})`)
      : ["- Keine Fälligkeiten in den nächsten 3 Tagen."]),
    "",
    "## Offene Freigaben",
    pendingApprovalRuns.length > 0
      ? `- ${pendingApprovalRuns.length} Lauf/Läufe warten auf Ihre Entscheidung (siehe Approval Center).`
      : "- Keine offenen Freigaben aus den letzten Läufen.",
    "",
    `_Grundlage: ${openTasks.length} offene Aufgaben und ${activity.length} protokollierte Ereignisse. Es werden ausschließlich vorhandene Daten ausgewertet._`,
  ].join("\n");

  const outcome = await ctx.prepareAction({
    actionType: "briefing.create",
    title: `Tagesbriefing ${new Date().toLocaleDateString("de-DE")}`,
    reasoning: `Zusammenfassung von ${openTasks.length} offenen Aufgaben, ${overdue.length} überfälligen Vorgängen und den letzten ${activity.length} Ereignissen.`,
    payload: {
      title: `Tagesbriefing ${new Date().toLocaleDateString("de-DE")}`,
      content: briefing,
    },
    affectedData: {
      offene_aufgaben: openTasks.length,
      ueberfaellig: overdue.length,
    },
    riskLevel: "low",
  });

  return {
    summary: `Tagesbriefing erstellt: ${openTasks.length} offene Aufgaben, ${overdue.length} überfällig, ${urgent.length} hoch priorisiert${outcome.mode === "approval_requested" ? " — wartet auf Freigabe" : ""}.`,
    output: { briefing, overdue: overdue.length, urgent: urgent.length },
  };
};

registerHandler("chief-of-staff:daily-briefing", dailyBriefingHandler);

const riskWatchHandler: CapabilityHandler = async (ctx) => {
  const tasksResult = await ctx.invokeTool("tasks.read", {
    status: ["open", "in_progress"],
    limit: 50,
  });
  const openTasks =
    (tasksResult.data as { title: string; dueAt: string | null; priority: string }[]) ??
    [];
  const now = Date.now();
  const overdue = openTasks.filter(
    (t) => t.dueAt && new Date(t.dueAt).getTime() < now,
  );

  if (overdue.length === 0) {
    return { summary: "Keine überfälligen Aufgaben — keine Risiken erkannt." };
  }

  await ctx.prepareAction({
    actionType: "notification.send",
    title: `${overdue.length} überfällige Aufgabe(n)`,
    reasoning: `Beim Abgleich der offenen Aufgaben wurden ${overdue.length} überschrittene Fristen festgestellt.`,
    payload: {
      type: "task_overdue",
      title: `${overdue.length} überfällige Aufgabe(n)`,
      body: overdue
        .slice(0, 5)
        .map((t) => `${t.title} (fällig ${new Date(t.dueAt!).toLocaleDateString("de-DE")})`)
        .join("; "),
      href: "/app/tasks",
    },
    affectedData: { ueberfaellig: overdue.length },
    riskLevel: "low",
  });

  return {
    summary: `${overdue.length} überfällige Aufgabe(n) erkannt und gemeldet.`,
    output: { overdue },
  };
};

registerHandler("chief-of-staff:risk-watch", riskWatchHandler);

/**
 * Priorisierung: ordnet die offenen Aufgaben nach Fälligkeit und gesetzter
 * Priorität und schlägt eine Reihenfolge vor. Bewusst regelbasiert statt über
 * das Sprachmodell — die Rangfolge ist damit nachvollziehbar und stabil.
 * Es werden ausschließlich `tasks.read` und `tasks.write` genutzt, also genau
 * die Werkzeuge, die die Fähigkeit im Katalog deklariert.
 */
const prioritizeHandler: CapabilityHandler = async (ctx) => {
  const tasksResult = await ctx.invokeTool("tasks.read", {
    status: ["open", "in_progress"],
    limit: 50,
  });
  const openTasks =
    (tasksResult.data as {
      id: string;
      title: string;
      priority: string;
      dueAt: string | null;
    }[]) ?? [];

  if (openTasks.length === 0) {
    return { summary: "Keine offenen Aufgaben — keine Priorisierung nötig." };
  }

  const rank = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
  const now = Date.now();
  const scored = openTasks
    .map((t) => {
      const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
      const overdue = due !== null && due < now;
      const dueSoon =
        due !== null && !overdue && due <= now + 3 * 24 * 60 * 60 * 1000;
      return { ...t, overdue, dueSoon, due };
    })
    .sort((a, b) => {
      // Überfällig schlägt Priorität; danach Priorität, danach Fälligkeit.
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const pr =
        (rank[a.priority as keyof typeof rank] ?? 2) -
        (rank[b.priority as keyof typeof rank] ?? 2);
      if (pr !== 0) return pr;
      return (a.due ?? Number.MAX_SAFE_INTEGER) - (b.due ?? Number.MAX_SAFE_INTEGER);
    });

  const overdueCount = scored.filter((t) => t.overdue).length;
  await ctx.recordStep("reason", "Rangfolge gebildet", {
    aufgaben: scored.length,
    ueberfaellig: overdueCount,
    regel: "überfällig > Priorität > Fälligkeitsdatum",
  });

  const top = scored.slice(0, 5);
  await ctx.prepareAction({
    actionType: "task.create",
    title: "Fokusliste für heute",
    reasoning: `Aus ${scored.length} offenen Aufgaben nach der Regel "überfällig vor Priorität vor Fälligkeit" gebildet; ${overdueCount} davon sind überfällig.`,
    riskLevel: "low",
    payload: {
      title: `Fokusliste (${top.length} Aufgaben)`,
      description: top
        .map(
          (t, i) =>
            `${i + 1}. ${t.title} — ${t.priority}${t.overdue ? ", überfällig" : t.dueSoon ? ", bald fällig" : ""}`,
        )
        .join("\n"),
      priority: overdueCount > 0 ? "high" : "normal",
      source: { runId: ctx.runId, capability: ctx.capability.key },
    },
    affectedData: { betrachtete_aufgaben: scored.length },
  });

  return {
    summary: `${scored.length} offene Aufgaben priorisiert (${overdueCount} überfällig). Vorschlag: ${top[0]!.title}.`,
    output: {
      order: scored.map((t) => ({
        id: t.id,
        title: t.title,
        priority: t.priority,
        overdue: t.overdue,
      })),
    },
  };
};

registerHandler("chief-of-staff:prioritize", prioritizeHandler);
