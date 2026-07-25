/**
 * Importziele und ihre Spalten — eine Quelle für Server und Oberfläche.
 *
 * Diese Datei enthält bewusst keine Server-Importe: Der Import läuft
 * serverseitig (`src/server/integrations/csv.ts`), die Spaltenhinweise stehen
 * aber in einer Client-Komponente. Vorher waren sie an zwei Stellen gepflegt —
 * eine neue Spalte hätte lautlos in der Oberfläche gefehlt.
 */

export const IMPORT_TARGETS = [
  "tasks",
  "deals",
  "contacts",
  "tickets",
  "employees",
] as const;

export type ImportTarget = (typeof IMPORT_TARGETS)[number];

export const IMPORT_TARGET_LABELS: Record<ImportTarget, string> = {
  tasks: "Aufgaben",
  deals: "Deals",
  contacts: "Kontakte",
  tickets: "Tickets",
  employees: "Beschäftigte",
};

export const TARGET_COLUMNS: Record<
  ImportTarget,
  { required: string[]; optional: string[] }
> = {
  tasks: {
    required: ["titel"],
    optional: ["beschreibung", "faellig_am", "prioritaet"],
  },
  deals: {
    required: ["name", "firma", "kontakt_email"],
    optional: ["wert_eur", "status", "letzte_aktivitaet", "notizen"],
  },
  contacts: {
    required: ["name"],
    optional: [
      "email",
      "telefon",
      "firma",
      "position",
      "art",
      "keine_ansprache",
      "notizen",
    ],
  },
  tickets: {
    required: ["betreff", "inhalt"],
    optional: [
      "absender_email",
      "status",
      "prioritaet",
      "kategorie",
      "team",
      "faellig_am",
    ],
  },
  employees: {
    required: ["name"],
    optional: [
      "email",
      "position",
      "abteilung",
      "status",
      "eintritt",
      "austritt",
      "urlaubstage",
    ],
  },
};

export function expectedColumns(target: ImportTarget) {
  return TARGET_COLUMNS[target];
}

export function isImportTarget(value: string): value is ImportTarget {
  return (IMPORT_TARGETS as readonly string[]).includes(value);
}
