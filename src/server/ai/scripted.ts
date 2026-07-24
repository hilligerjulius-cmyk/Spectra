import { z } from "zod";
import { AI_TASKS, type AITaskType } from "./schemas";
import type { AIProvider, AITaskRequest, AITaskResult } from "./types";

/**
 * Deterministischer, regelbasierter Provider für Demo-, Sandbox- und
 * Testbetrieb ohne Anthropic-API-Key. Er verwendet transparente Heuristiken
 * (Schlüsselwörter, Datums-Regex) statt eines LLM. Ergebnisse sind
 * reproduzierbar — ideal für Tests; die Qualität ist bewusst begrenzt und
 * wird im UI als "Demo-Modus (regelbasiert)" gekennzeichnet.
 */

const DATE_PATTERNS = [
  /\b(\d{4})-(\d{2})-(\d{2})\b/g, // ISO
  /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, // deutsch
];

function extractDates(text: string): string[] {
  const dates = new Set<string>();
  for (const match of text.matchAll(DATE_PATTERNS[0]!)) {
    dates.add(match[0]!);
  }
  for (const match of text.matchAll(DATE_PATTERNS[1]!)) {
    const [, d, m, y] = match;
    dates.add(`${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`);
  }
  return [...dates];
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

function firstSentences(text: string, count: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  return sentences.slice(0, count).join(" ").slice(0, 400);
}

const zeroUsage = (model: string) => ({
  promptTokens: 0,
  completionTokens: 0,
  costDeciCents: 0,
  model,
});

export class ScriptedProvider implements AIProvider {
  readonly name = "scripted";
  readonly isReal = false;

  async run<T extends AITaskType>(
    req: AITaskRequest<T>,
  ): Promise<AITaskResult<T>> {
    const task = AI_TASKS[req.taskType];
    const raw = this.execute(req.taskType, req.input, req.context ?? "");
    return {
      data: task.schema.parse(raw) as AITaskResult<T>["data"],
      usage: zeroUsage("scripted/regelbasiert"),
    };
  }

  private execute(taskType: AITaskType, input: string, context: string) {
    const lower = input.toLowerCase();
    switch (taskType) {
      case "email.classify": {
        const category = includesAny(lower, ["rechnung", "invoice", "zahlung", "mahnung"])
          ? "rechnung"
          : includesAny(lower, ["bewerbung", "lebenslauf", "cv "])
            ? "bewerbung"
            : includesAny(lower, ["fehler", "problem", "funktioniert nicht", "support", "störung", "beschwerde"])
              ? "support"
              : includesAny(lower, ["termin", "meeting", "call", "kalender"])
                ? "termin"
                : includesAny(lower, ["newsletter", "abmelden", "unsubscribe"])
                  ? "newsletter"
                  : includesAny(lower, ["gewonnen", "krypto", "bitcoin-wallet", "passwort bestätigen", "konto verifizieren"])
                    ? "spam_verdacht"
                    : includesAny(lower, ["angebot", "anfrage", "interesse", "preis"])
                      ? "anfrage"
                      : "sonstiges";
        const urgency = includesAny(lower, ["dringend", "sofort", "asap", "heute noch", "kritisch", "eskalation"])
          ? "kritisch"
          : includesAny(lower, ["bis morgen", "zeitnah", "frist", "deadline", "bis ende der woche", "wichtig"])
            ? "hoch"
            : includesAny(lower, ["kein stress", "irgendwann", "bei gelegenheit"])
              ? "niedrig"
              : "normal";
        const suspicious =
          category === "spam_verdacht" ||
          includesAny(lower, ["iban geändert", "neue bankverbindung", "gutscheinkarten", "anhang öffnen und bestätigen"]);
        return {
          category,
          urgency,
          suspicious,
          suspicionReason: suspicious
            ? "Regelbasierte Erkennung: Formulierungen deuten auf Phishing oder Zahlungsbetrug hin."
            : null,
          deadlines: extractDates(input),
          summary: firstSentences(input.replace(/^(Betreff|Subject):.*$/im, ""), 2) || "E-Mail ohne auswertbaren Textinhalt.",
        };
      }

      case "tasks.extract": {
        const tasks: {
          title: string;
          description: string | null;
          dueDate: string | null;
          priority: "low" | "normal" | "high" | "urgent";
        }[] = [];
        const dates = extractDates(input);
        const lines = input.split(/\n|(?<=[.!?])\s+/);
        const verbs = ["bitte", "senden", "schicken", "erstellen", "prüfen", "klären", "vorbereiten", "melden", "übermitteln", "freigeben", "bestätigen", "zurückrufen", "vereinbaren", "aktualisieren"];
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.length < 12 || trimmed.length > 300) continue;
          if (!includesAny(trimmed.toLowerCase(), verbs)) continue;
          const lineDates = extractDates(trimmed);
          tasks.push({
            title: trimmed.replace(/^[-*•\d.)\s]+/, "").slice(0, 120),
            description: trimmed.length > 120 ? trimmed.slice(0, 300) : null,
            dueDate: lineDates[0] ?? dates[0] ?? null,
            priority: includesAny(trimmed.toLowerCase(), ["dringend", "sofort", "asap"])
              ? "urgent"
              : includesAny(trimmed.toLowerCase(), ["frist", "deadline", "bis "])
                ? "high"
                : "normal",
          });
          if (tasks.length >= 5) break;
        }
        return { tasks };
      }

      case "text.summarize": {
        const sentences = input.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
        return {
          summary: firstSentences(input, 3) || "Kein auswertbarer Inhalt.",
          keyPoints: sentences
            .filter((s) => s.length > 30)
            .slice(0, 5)
            .map((s) => s.slice(0, 160)),
        };
      }

      case "email.draft-reply": {
        const isComplaint = includesAny(lower, ["beschwerde", "problem", "fehler", "enttäuscht"]);
        const isInquiry = includesAny(lower, ["angebot", "preis", "interesse", "anfrage"]);
        const body = isComplaint
          ? "vielen Dank für Ihre Nachricht — es tut uns leid, dass es zu Unannehmlichkeiten gekommen ist. Wir haben Ihr Anliegen aufgenommen und prüfen es umgehend. Wir melden uns mit einer Lösung bei Ihnen.\n\n[PLATZHALTER: konkrete Lösung/Antwort ergänzen]\n\nMit freundlichen Grüßen"
          : isInquiry
            ? "vielen Dank für Ihre Anfrage und Ihr Interesse. Gerne stellen wir Ihnen die gewünschten Informationen zusammen.\n\n[PLATZHALTER: Angebot/Details ergänzen]\n\nMit freundlichen Grüßen"
            : "vielen Dank für Ihre Nachricht. Wir haben Ihr Anliegen erhalten und kümmern uns darum.\n\n[PLATZHALTER: konkrete Antwort ergänzen]\n\nMit freundlichen Grüßen";
        return {
          subject: "AW: " + (input.match(/^(?:Betreff|Subject):\s*(.+)$/im)?.[1]?.trim() ?? "Ihre Nachricht"),
          body: `Guten Tag,\n\n${body}`,
          missingInfo: ["Konkrete inhaltliche Antwort (Platzhalter im Entwurf markiert)"],
        };
      }

      case "followup.draft": {
        return {
          subject: "Kurze Nachfrage zu unserem Angebot",
          body: `Guten Tag,\n\nich wollte mich kurz erkundigen, ob Sie bereits Gelegenheit hatten, unser Angebot zu prüfen.${context ? `\n\nZum Hintergrund: ${firstSentences(context, 1)}` : ""}\n\nFalls Fragen offen sind oder Anpassungen sinnvoll wären, melden Sie sich gerne — wir finden eine passende Lösung.\n\nMit freundlichen Grüßen`,
          rationale:
            "Regelbasiert: Das Angebot ist seit mehreren Tagen unbeantwortet; ein freundliches Follow-up erhöht erfahrungsgemäß die Antwortquote.",
        };
      }

      case "invoice.extract": {
        const invoiceNumber =
          input.match(/(?:Rechnungs(?:nummer|-Nr\.?|nr\.?)|Invoice(?:\s*No\.?|\s*Number)?)[:\s#]*([A-Z0-9][A-Z0-9\-/]{2,24})/i)?.[1] ?? null;
        const amountMatch =
          input.match(/(?:Gesamtbetrag|Rechnungsbetrag|Total|Summe|Brutto)[:\s]*(?:EUR|€)?\s*([\d.,]+)\s*(?:EUR|€)?/i) ??
          input.match(/(?:EUR|€)\s*([\d.,]+)/);
        let totalAmountCents: number | null = null;
        if (amountMatch?.[1]) {
          const normalized = amountMatch[1].replace(/\./g, "").replace(",", ".");
          const parsed = Number.parseFloat(normalized);
          if (Number.isFinite(parsed)) totalAmountCents = Math.round(parsed * 100);
        }
        const dates = extractDates(input);
        const vendorName =
          input.match(/^(?:Von|From|Lieferant|Aussteller):\s*(.+)$/im)?.[1]?.trim() ??
          input.split("\n").map((l) => l.trim()).find((l) => l.length > 3 && l.length < 80 && /(GmbH|AG|KG|UG|e\.K\.|Ltd|Inc)/.test(l)) ??
          null;
        const iban = input.match(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}\b/)?.[0]?.replace(/\s/g, "") ?? null;
        const missingFields: string[] = [];
        if (!invoiceNumber) missingFields.push("Rechnungsnummer");
        if (totalAmountCents == null) missingFields.push("Gesamtbetrag");
        if (dates.length === 0) missingFields.push("Rechnungsdatum");
        if (!vendorName) missingFields.push("Lieferant");
        return {
          invoiceNumber,
          vendorName,
          totalAmountCents,
          currency: /EUR|€/.test(input) ? "EUR" : null,
          invoiceDate: dates[0] ?? null,
          dueDate: dates[1] ?? null,
          iban,
          missingFields,
          possibleDuplicateOf: null,
        };
      }

      case "qa.answer": {
        // Input-Format: Frage + Chunks als "[[chunk:<id>]] <text>"-Blöcke
        const chunkRegex = /\[\[chunk:([^\]]+)\]\]\s*([\s\S]*?)(?=\[\[chunk:|$)/g;
        const question = (input.match(/^Frage:\s*(.+)$/im)?.[1] ?? input.split("\n")[0] ?? "").toLowerCase();
        const questionTerms = question
          .replace(/[?!.,;:]/g, " ")
          .split(/\s+/)
          .filter((t) => t.length > 3);
        const scored: { id: string; text: string; score: number }[] = [];
        for (const match of input.matchAll(chunkRegex)) {
          const [, id, text] = match;
          const chunkLower = text!.toLowerCase();
          const score = questionTerms.filter((t) => chunkLower.includes(t)).length;
          scored.push({ id: id!, text: text!.trim(), score });
        }
        scored.sort((a, b) => b.score - a.score);
        const relevant = scored.filter((c) => c.score > 0).slice(0, 3);
        if (relevant.length === 0) {
          return {
            answer:
              "Für diese Frage liegt in den freigegebenen Quellen kein Beleg vor. Bitte laden Sie passende Dokumente hoch oder präzisieren Sie die Frage.",
            usedChunkIds: [],
            confidence: "nicht_belegt",
          };
        }
        const best = relevant[0]!;
        return {
          answer: `${firstSentences(best.text, 3)}`,
          usedChunkIds: relevant.map((c) => c.id),
          confidence: relevant.length > 1 ? "belegt" : "teilweise_belegt",
        };
      }

      case "generic.analysis": {
        const dates = extractDates(input);
        const findings: { title: string; detail: string; severity: "info" | "hinweis" | "warnung" | "kritisch" }[] = [];
        if (includesAny(lower, ["überfällig", "verzug", "überschritten"])) {
          findings.push({
            title: "Überfällige Vorgänge erkannt",
            detail: "In den Daten finden sich Hinweise auf überfällige oder in Verzug geratene Vorgänge.",
            severity: "warnung",
          });
        }
        if (dates.length > 0) {
          findings.push({
            title: "Termine/Fristen in den Daten",
            detail: `Erkannte Daten: ${dates.slice(0, 5).join(", ")}`,
            severity: "hinweis",
          });
        }
        if (findings.length === 0) {
          findings.push({
            title: "Keine Auffälligkeiten",
            detail: "Die regelbasierte Analyse hat keine kritischen Muster erkannt.",
            severity: "info",
          });
        }
        return {
          summary: firstSentences(input, 2) || "Analyse der übergebenen Daten abgeschlossen.",
          findings,
          recommendations:
            findings[0]!.severity === "warnung"
              ? ["Überfällige Vorgänge priorisiert prüfen und Verantwortliche informieren."]
              : ["Keine unmittelbaren Maßnahmen erforderlich."],
        };
      }

      default: {
        const _exhaustive: never = taskType;
        throw new Error(`ScriptedProvider: unbekannter Task-Typ ${String(_exhaustive)}`);
      }
    }
  }
}

/** Hilfsfunktion für Tests: prüft, dass jede Task-Definition ein Zod-Schema hat. */
export function assertTaskRegistryComplete(): void {
  for (const [key, def] of Object.entries(AI_TASKS)) {
    if (!(def.schema instanceof z.ZodType)) {
      throw new Error(`AI-Task ${key} ohne gültiges Schema`);
    }
  }
}
