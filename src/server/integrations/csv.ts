import "server-only";
import { desc } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import {
  agentRun,
  contact,
  deal,
  employee,
  task,
  ticket,
} from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { TARGET_COLUMNS, type ImportTarget } from "@/lib/csv-targets";

/**
 * CSV-Import und -Export.
 *
 * Bewusst ohne zusätzliche Bibliothek: Der Parser ist klein, vollständig
 * testbar und behandelt genau das, was RFC 4180 für unsere Fälle verlangt —
 * Trennzeichen, Anführungszeichen, doppelte Anführungszeichen und
 * Zeilenumbrüche innerhalb von Feldern. Semikolon wird zusätzlich erkannt,
 * weil deutsche Tabellenprogramme es als Standard verwenden.
 */

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 5000;

/** Erkennt das Trennzeichen anhand der Kopfzeile. */
export function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = {
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  };
  const best = (Object.keys(counts) as ("," | ";" | "\t")[]).reduce((a, b) =>
    counts[a] >= counts[b] ? a : b,
  );
  return counts[best] > 0 ? best : ",";
}

export function parseCsv(
  text: string,
  delimiter?: string,
): { headers: string[]; rows: Record<string, string>[] } {
  // BOM entfernen — Excel schreibt ihn beim UTF-8-Export.
  const clean = text.replace(/^﻿/, "");
  const sep = delimiter ?? detectDelimiter(clean);

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"'; // verdoppeltes Anführungszeichen = literales "
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      record.push(field);
      field = "";
    } else if (char === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0]!.map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

/** Escaped ein Feld nach RFC 4180. */
function csvField(value: unknown): string {
  const str =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value);
  return /["\n\r;,]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(
  headers: string[],
  rows: Record<string, unknown>[],
  delimiter = ";",
): string {
  const lines = [
    headers.join(delimiter),
    ...rows.map((row) => headers.map((h) => csvField(row[h])).join(delimiter)),
  ];
  // BOM voranstellen, damit Excel UTF-8 korrekt erkennt.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

export type { ImportTarget };
export { expectedColumns } from "@/lib/csv-targets";

export interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  /** Zeilennummer (1-basiert, ohne Kopfzeile) und Grund. */
  problems: { row: number; reason: string }[];
  message: string;
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  // Deutsches Format zuerst, danach ISO.
  const german = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);
  const date = german
    ? new Date(
        `${german[3]}-${german[2]!.padStart(2, "0")}-${german[1]!.padStart(2, "0")}`,
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Erkennt bejahende Werte in Importdateien (ja/yes/wahr/1/x). */
function isTruthy(value: string): boolean {
  return ["ja", "yes", "true", "wahr", "1", "x"].includes(
    value.trim().toLowerCase(),
  );
}

function parseAmountCents(value: string): number | null {
  if (!value) return null;
  const normalized = value
    .replace(/[^\d.,-]/g, "")
    .replace(/\.(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
}

/**
 * Importiert Zeilen. Fehlerhafte Zeilen werden übersprungen und einzeln
 * benannt — ein Teilimport ist ehrlicher als ein Komplettabbruch, solange
 * genau berichtet wird, was nicht übernommen wurde.
 */
export async function importCsv(params: {
  organizationId: string;
  userId: string;
  userLabel: string;
  target: ImportTarget;
  content: string;
}): Promise<ImportResult> {
  if (Buffer.byteLength(params.content, "utf8") > MAX_CSV_BYTES) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      problems: [],
      message: `Datei ist größer als ${MAX_CSV_BYTES / 1024 / 1024} MB.`,
    };
  }

  const { headers, rows } = parseCsv(params.content);
  if (rows.length === 0) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      problems: [],
      message: "Die Datei enthält keine Datenzeilen.",
    };
  }
  if (rows.length > MAX_CSV_ROWS) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      problems: [],
      message: `Die Datei enthält ${rows.length} Zeilen; erlaubt sind ${MAX_CSV_ROWS}. Bitte aufteilen.`,
    };
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  const spec = TARGET_COLUMNS[params.target];
  const missing = spec.required.filter((c) => !normalizedHeaders.includes(c));
  if (missing.length > 0) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      problems: [],
      message: `Es fehlen die Pflichtspalten: ${missing.join(", ")}. Gefunden wurden: ${headers.join(", ") || "keine"}.`,
    };
  }

  // Zeilen auf normalisierte Spaltennamen umschlüsseln
  const normalizedRows = rows.map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((header, index) => {
      out[normalizedHeaders[index]!] = row[header] ?? "";
    });
    return out;
  });

  const problems: { row: number; reason: string }[] = [];
  let imported = 0;

  if (params.target === "tasks") {
    for (const [index, row] of normalizedRows.entries()) {
      const title = row.titel?.trim();
      if (!title) {
        problems.push({ row: index + 1, reason: "Spalte 'titel' ist leer." });
        continue;
      }
      const dueAt = parseDate(row.faellig_am ?? "");
      if (row.faellig_am && !dueAt) {
        problems.push({
          row: index + 1,
          reason: `Datum "${row.faellig_am}" nicht lesbar — Aufgabe ohne Frist übernommen.`,
        });
      }
      const priority = ["low", "normal", "high", "urgent"].includes(
        row.prioritaet ?? "",
      )
        ? (row.prioritaet as "low" | "normal" | "high" | "urgent")
        : "normal";

      await withOrg(params.organizationId, (tx) =>
        tx.insert(task).values({
          organizationId: params.organizationId,
          title: title.slice(0, 200),
          description: row.beschreibung?.slice(0, 2000) || null,
          dueAt,
          priority,
          status: "open",
          createdByType: "user",
          createdById: params.userId,
          source: { connector: "csv", importedAt: new Date().toISOString() },
        }),
      );
      imported++;
    }
  } else if (params.target === "contacts") {
    const kinds = ["lead", "kunde", "partner", "lieferant", "sonstige"];
    for (const [index, row] of normalizedRows.entries()) {
      const fullName = row.name?.trim();
      if (!fullName) {
        problems.push({ row: index + 1, reason: "Spalte 'name' ist leer." });
        continue;
      }
      const email = row.email?.trim() || null;
      if (email && !email.includes("@")) {
        problems.push({
          row: index + 1,
          reason: `"${email}" ist keine E-Mail-Adresse — Zeile übersprungen.`,
        });
        continue;
      }
      const kind = kinds.includes(row.art ?? "") ? row.art! : "lead";
      // Ein Sperrvermerk aus der Quelldatei wird übernommen, aber nie
      // aufgehoben: Ein fehlender Wert bedeutet nicht "Ansprache erlaubt".
      const doNotContact = isTruthy(row.keine_ansprache ?? "");

      try {
        await withOrg(params.organizationId, (tx) =>
          tx.insert(contact).values({
            organizationId: params.organizationId,
            fullName: fullName.slice(0, 200),
            email,
            phone: row.telefon?.slice(0, 60) || null,
            company: row.firma?.slice(0, 200) || null,
            role: row.position?.slice(0, 120) || null,
            kind,
            doNotContact,
            notes: row.notizen?.slice(0, 4000) || null,
          }),
        );
        imported++;
      } catch {
        // Der eindeutige Index auf (organization_id, email) verhindert
        // Dubletten. Das ist gewollt und keine Fehlfunktion.
        problems.push({
          row: index + 1,
          reason: `Kontakt mit E-Mail "${email}" existiert bereits — nicht überschrieben.`,
        });
      }
    }
  } else if (params.target === "tickets") {
    const statuses = [
      "neu",
      "in_bearbeitung",
      "wartet_auf_kunde",
      "geloest",
      "geschlossen",
    ];
    // Startnummer einmal bestimmen und hochzählen; der eindeutige Index fängt
    // einen Wettlauf ab, falls parallel importiert wird.
    const year = new Date().getFullYear();
    const prefix = `T-${year}-`;
    const existingRefs = await withOrg(params.organizationId, (tx) =>
      tx
        .select({ reference: ticket.reference })
        .from(ticket)
        .orderBy(desc(ticket.reference))
        .limit(1),
    );
    let counter = existingRefs[0]?.reference?.startsWith(prefix)
      ? Number.parseInt(existingRefs[0].reference.slice(prefix.length), 10) || 0
      : 0;

    for (const [index, row] of normalizedRows.entries()) {
      const subject = row.betreff?.trim();
      const body = row.inhalt?.trim();
      if (!subject || !body) {
        problems.push({
          row: index + 1,
          reason: "Pflichtfeld 'betreff' oder 'inhalt' ist leer.",
        });
        continue;
      }
      const status = statuses.includes(row.status ?? "") ? row.status! : "neu";
      if (row.status && status !== row.status) {
        problems.push({
          row: index + 1,
          reason: `Unbekannter Status "${row.status}" — auf "neu" gesetzt.`,
        });
      }
      const priority = ["low", "normal", "high", "urgent"].includes(
        row.prioritaet ?? "",
      )
        ? row.prioritaet!
        : "normal";

      counter++;
      await withOrg(params.organizationId, (tx) =>
        tx.insert(ticket).values({
          organizationId: params.organizationId,
          reference: `${prefix}${String(counter).padStart(4, "0")}`,
          subject: subject.slice(0, 200),
          body: body.slice(0, 20_000),
          requesterEmail: row.absender_email?.slice(0, 200) || null,
          status,
          priority,
          category: row.kategorie?.slice(0, 60) || null,
          assignedTeam: row.team?.slice(0, 80) || null,
          dueAt: parseDate(row.faellig_am ?? ""),
        }),
      );
      imported++;
    }
  } else if (params.target === "employees") {
    const statuses = ["aktiv", "eintritt_geplant", "beurlaubt", "ausgetreten"];
    for (const [index, row] of normalizedRows.entries()) {
      const fullName = row.name?.trim();
      if (!fullName) {
        problems.push({ row: index + 1, reason: "Spalte 'name' ist leer." });
        continue;
      }
      const workEmail = row.email?.trim() || null;
      const status = statuses.includes(row.status ?? "") ? row.status! : "aktiv";
      const vacationDays = Number.parseInt(row.urlaubstage ?? "", 10);

      try {
        await withOrg(params.organizationId, (tx) =>
          tx.insert(employee).values({
            organizationId: params.organizationId,
            fullName: fullName.slice(0, 200),
            workEmail,
            jobTitle: row.position?.slice(0, 200) || null,
            department: row.abteilung?.slice(0, 120) || null,
            status,
            startDate: parseDate(row.eintritt ?? ""),
            endDate: parseDate(row.austritt ?? ""),
            vacationDaysPerYear: Number.isFinite(vacationDays)
              ? vacationDays
              : null,
          }),
        );
        imported++;
      } catch {
        problems.push({
          row: index + 1,
          reason: `Beschäftigte/r mit E-Mail "${workEmail}" existiert bereits — nicht überschrieben.`,
        });
      }
    }
  } else {
    const stages = [
      "lead",
      "angebot_versendet",
      "verhandlung",
      "gewonnen",
      "verloren",
    ];
    for (const [index, row] of normalizedRows.entries()) {
      const name = row.name?.trim();
      const company = row.firma?.trim();
      const contactEmail = row.kontakt_email?.trim();
      if (!name || !company || !contactEmail) {
        problems.push({
          row: index + 1,
          reason: "Pflichtfeld 'name', 'firma' oder 'kontakt_email' ist leer.",
        });
        continue;
      }
      const stage = stages.includes(row.status ?? "") ? row.status! : "lead";
      if (row.status && stage !== row.status) {
        problems.push({
          row: index + 1,
          reason: `Unbekannter Status "${row.status}" — auf "lead" gesetzt.`,
        });
      }
      await withOrg(params.organizationId, (tx) =>
        tx.insert(deal).values({
          organizationId: params.organizationId,
          name: name.slice(0, 200),
          company: company.slice(0, 200),
          contactEmail: contactEmail.slice(0, 200),
          valueCents: parseAmountCents(row.wert_eur ?? ""),
          stage,
          lastActivityAt: parseDate(row.letzte_aktivitaet ?? ""),
          notes: row.notizen?.slice(0, 2000) || null,
        }),
      );
      imported++;
    }
  }

  await recordAudit({
    organizationId: params.organizationId,
    actorType: "user",
    actorId: params.userId,
    actorLabel: params.userLabel,
    action: "integration.csv_imported",
    targetType: params.target,
    summary: `CSV-Import (${params.target}): ${imported} übernommen, ${problems.length} übersprungen.`,
    metadata: { imported, skipped: problems.length },
  });

  return {
    ok: imported > 0,
    imported,
    skipped: problems.length,
    problems: problems.slice(0, 20),
    message:
      problems.length === 0
        ? `${imported} Datensätze übernommen.`
        : `${imported} Datensätze übernommen, ${problems.length} übersprungen.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Export                                                                     */
/* -------------------------------------------------------------------------- */

export type ExportTarget = "tasks" | "deals" | "runs";

export async function exportCsv(params: {
  organizationId: string;
  target: ExportTarget;
}): Promise<{ filename: string; content: string; rowCount: number }> {
  const stamp = new Date().toISOString().slice(0, 10);

  if (params.target === "tasks") {
    const rows = await withOrg(params.organizationId, (tx) =>
      tx.select().from(task).orderBy(desc(task.createdAt)).limit(MAX_CSV_ROWS),
    );
    const headers = [
      "titel",
      "beschreibung",
      "status",
      "prioritaet",
      "faellig_am",
      "erstellt_von",
      "erstellt_am",
    ];
    return {
      filename: `aufgaben-${stamp}.csv`,
      rowCount: rows.length,
      content: toCsv(
        headers,
        rows.map((t) => ({
          titel: t.title,
          beschreibung: t.description,
          status: t.status,
          prioritaet: t.priority,
          faellig_am: t.dueAt?.toISOString().slice(0, 10) ?? "",
          erstellt_von: t.createdByType,
          erstellt_am: t.createdAt.toISOString(),
        })),
      ),
    };
  }

  if (params.target === "deals") {
    const rows = await withOrg(params.organizationId, (tx) =>
      tx.select().from(deal).orderBy(desc(deal.createdAt)).limit(MAX_CSV_ROWS),
    );
    const headers = [
      "name",
      "firma",
      "kontakt_email",
      "wert_eur",
      "status",
      "letzte_aktivitaet",
      "kontaktsperre",
      "notizen",
    ];
    return {
      filename: `deals-${stamp}.csv`,
      rowCount: rows.length,
      content: toCsv(
        headers,
        rows.map((d) => ({
          name: d.name,
          firma: d.company,
          kontakt_email: d.contactEmail,
          wert_eur: d.valueCents !== null ? (d.valueCents / 100).toFixed(2) : "",
          status: d.stage,
          letzte_aktivitaet: d.lastActivityAt?.toISOString().slice(0, 10) ?? "",
          kontaktsperre: d.doNotContact ? "ja" : "nein",
          notizen: d.notes,
        })),
      ),
    };
  }

  const rows = await withOrg(params.organizationId, (tx) =>
    tx.select().from(agentRun).orderBy(desc(agentRun.createdAt)).limit(MAX_CSV_ROWS),
  );
  const headers = [
    "datum",
    "agent",
    "faehigkeit",
    "status",
    "zusammenfassung",
    "dauer_ms",
    "kosten_eur",
    "modell",
    "sandbox",
  ];
  return {
    filename: `agentenlaeufe-${stamp}.csv`,
    rowCount: rows.length,
    content: toCsv(
      headers,
      rows.map((r) => ({
        datum: r.createdAt.toISOString(),
        agent: r.definitionSlug,
        faehigkeit: r.capabilityKey,
        status: r.status,
        zusammenfassung: r.summary,
        dauer_ms: r.durationMs,
        kosten_eur: (r.costDeciCents / 1000).toFixed(4),
        modell: r.model,
        sandbox: r.sandbox ? "ja" : "nein",
      })),
    ),
  };
}
