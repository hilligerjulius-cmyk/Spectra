/**
 * Fälligkeitsberechnung für Zeitpläne.
 *
 * Bewusst ohne Cron: Für ein Fachprodukt sind vier Muster ausreichend
 * (stündlich, täglich, werktäglich, wöchentlich), und sie sind für Nutzende
 * verständlich. Cron-Ausdrücke wären mächtiger, aber auch die häufigste Quelle
 * falsch gesetzter Zeitpläne.
 *
 * Der zentrale Trick ist das **Slot-Verfahren**: Statt den nächsten
 * Ausführungszeitpunkt als Zeitstempel zu berechnen — was eine Rückrechnung von
 * Ortszeit auf UTC und damit Zeitzonen-Arithmetik erfordern würde — wird für den
 * aktuellen Moment eine Slot-Kennung in der Zeitzone der Organisation gebildet
 * (z. B. `2026-07-27` für „täglich 07:00"). Ein Lauf ist fällig, wenn die
 * Ortszeit den Zeitpunkt erreicht hat und der Slot noch nicht gelaufen ist.
 *
 * Das hat drei Vorteile: keine Zeitzonen-Rückrechnung, Sommerzeitwechsel führen
 * nicht zu doppelten oder verlorenen Läufen, und die Funktion ist ohne
 * Datenbank und ohne laufenden Worker testbar.
 */

export type ScheduleFrequency = "hourly" | "daily" | "weekday" | "weekly";

export interface ScheduleSpec {
  frequency: ScheduleFrequency;
  /** Stunde 0–23 in der Zeitzone der Organisation. Ohne Bedeutung bei "hourly". */
  hour: number;
  /** Minute 0–59. */
  minute: number;
  /** Wochentag 1 (Montag) bis 7 (Sonntag), nur für "weekly". */
  weekday: number | null;
  /** IANA-Zeitzone, z. B. "Europe/Berlin". */
  timezone: string;
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 1 = Montag … 7 = Sonntag (ISO). */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

/**
 * Zerlegt einen Zeitpunkt in die Ortszeit-Bestandteile einer Zeitzone.
 * Nutzt `Intl` aus der Standardbibliothek — keine zusätzliche Abhängigkeit und
 * damit auch keine veraltende Zeitzonendatenbank im Projekt.
 */
export function localParts(instant: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // "24" statt "00" kommt bei hour12:false in manchen Umgebungen vor.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday ?? "Mon"] ?? 1,
  };
}

/** Prüft, ob eine Zeitzone von dieser Node-Installation unterstützt wird. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function dateSlot(p: LocalParts): string {
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/**
 * Die Slot-Kennung des aktuell erreichten Ausführungsfensters — oder `null`,
 * wenn der Zeitpunkt heute noch nicht erreicht ist bzw. der Tag nicht passt.
 */
export function currentSlot(spec: ScheduleSpec, now: Date): string | null {
  const p = localParts(now, spec.timezone);

  switch (spec.frequency) {
    case "hourly":
      // Innerhalb der Stunde wird auf die konfigurierte Minute gewartet.
      if (p.minute < spec.minute) return null;
      return `${dateSlot(p)}T${pad(p.hour)}`;

    case "daily":
      if (!reachedTime(p, spec)) return null;
      return dateSlot(p);

    case "weekday":
      // Montag bis Freitag.
      if (p.weekday > 5) return null;
      if (!reachedTime(p, spec)) return null;
      return dateSlot(p);

    case "weekly":
      if (spec.weekday === null || p.weekday !== spec.weekday) return null;
      if (!reachedTime(p, spec)) return null;
      return dateSlot(p);
  }
}

function reachedTime(p: LocalParts, spec: ScheduleSpec): boolean {
  return p.hour > spec.hour || (p.hour === spec.hour && p.minute >= spec.minute);
}

/**
 * Ist der Zeitplan jetzt fällig?
 *
 * `lastRunSlot` ist die zuletzt ausgeführte Slot-Kennung. Ein Slot läuft
 * höchstens einmal — auch wenn der Worker mehrfach pro Minute prüft, nach einem
 * Neustart aufholt oder die Uhr im Herbst eine Stunde zurückspringt.
 */
export function isDue(
  spec: ScheduleSpec,
  now: Date,
  lastRunSlot: string | null,
): { due: boolean; slot: string | null } {
  const slot = currentSlot(spec, now);
  if (slot === null) return { due: false, slot: null };
  return { due: slot !== lastRunSlot, slot };
}

/**
 * Lesbare Beschreibung für Oberfläche und Protokoll. Nennt die Zeitzone mit,
 * weil „täglich 07:00" ohne sie mehrdeutig ist.
 */
export function describeSchedule(spec: ScheduleSpec): string {
  const time = `${pad(spec.hour)}:${pad(spec.minute)}`;
  const names = [
    "",
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag",
  ];
  switch (spec.frequency) {
    case "hourly":
      return `stündlich zur Minute ${pad(spec.minute)} (${spec.timezone})`;
    case "daily":
      return `täglich um ${time} (${spec.timezone})`;
    case "weekday":
      return `montags bis freitags um ${time} (${spec.timezone})`;
    case "weekly":
      return `jeden ${names[spec.weekday ?? 1]} um ${time} (${spec.timezone})`;
  }
}

/** Grenzen für die Validierung — auch serverseitig durchgesetzt. */
export const SCHEDULE_LIMITS = {
  frequencies: ["hourly", "daily", "weekday", "weekly"] as const,
  minHour: 0,
  maxHour: 23,
  minMinute: 0,
  maxMinute: 59,
  minWeekday: 1,
  maxWeekday: 7,
} as const;
