/**
 * Warteschlangen des Workers — Namen, Nutzlasten und Wiederholungsverhalten.
 *
 * Die Konfiguration steht bewusst hier und nicht verstreut an den Aufrufstellen:
 * Wie oft etwas wiederholt wird, ist eine Betriebsentscheidung, die man an einer
 * Stelle nachlesen können muss.
 */

export const QUEUES = {
  /** Herzschlag: prüft jede Minute, welche Zeitpläne fällig sind. */
  scheduleTick: "schedule-tick",
  /** Ein einzelner Agentenlauf. */
  agentRun: "agent-run",
  /** Tageszusammenfassungen versenden. */
  digest: "digest-tick",
  /** Monatlicher Abrechnungslauf. */
  billing: "billing-tick",
  /** Abgelaufene Freigaben schließen. */
  approvalExpiry: "approval-expiry",
  /** Endlager für Jobs, die alle Versuche aufgebraucht haben. */
  deadLetter: "dead-letter",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface AgentRunPayload {
  organizationId: string;
  instanceId: string;
  capabilityKey: string;
  goal: string;
  /** Zeitplan, aus dem der Lauf entstand — für die Rückmeldung. */
  scheduleId?: string;
  /** Slot des Zeitplans; dient zugleich als Idempotenzschlüssel. */
  slot?: string;
  input?: Record<string, unknown>;
}

export interface TickPayload {
  /** Wird von der Zeitsteuerung gesetzt; im Test übergeben wir eine feste Zeit. */
  at?: string;
}

/**
 * Warteschlangenkonfiguration.
 *
 * `agentRun` bekommt bewusst nur zwei Wiederholungen mit exponentiellem
 * Abstand: Ein Agentenlauf kostet Geld und Kontingent, deshalb ist blindes
 * Wiederholen teuer. Läufe, die endgültig scheitern, landen im Endlager und
 * bleiben dort sichtbar, statt still zu verschwinden.
 *
 * Die Taktgeber (`*Tick`) laufen als `singleton`: Es darf nie mehr als ein
 * Durchlauf gleichzeitig aktiv sein, auch nicht bei zwei Worker-Prozessen.
 */
export const QUEUE_CONFIG = {
  [QUEUES.scheduleTick]: {
    policy: "singleton" as const,
    retryLimit: 0,
    // Ein hängender Tick soll nach zwei Minuten freigegeben werden, damit der
    // nächste Takt nicht dauerhaft blockiert.
    expireInSeconds: 120,
    deleteAfterSeconds: 3600,
  },
  [QUEUES.agentRun]: {
    policy: "standard" as const,
    retryLimit: 2,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 300,
    deadLetter: QUEUES.deadLetter,
  },
  [QUEUES.digest]: {
    policy: "singleton" as const,
    retryLimit: 1,
    retryDelay: 300,
    expireInSeconds: 300,
  },
  [QUEUES.billing]: {
    policy: "singleton" as const,
    retryLimit: 2,
    retryDelay: 600,
    expireInSeconds: 600,
  },
  [QUEUES.approvalExpiry]: {
    policy: "singleton" as const,
    retryLimit: 1,
    expireInSeconds: 120,
  },
  [QUEUES.deadLetter]: {
    policy: "standard" as const,
    retryLimit: 0,
    // Endgültig gescheiterte Jobs bleiben 30 Tage einsehbar.
    deleteAfterSeconds: 30 * 24 * 3600,
  },
} satisfies Record<QueueName, Record<string, unknown>>;

/**
 * Zeitsteuerung der Taktgeber (UTC-Cron, von pg-boss ausgewertet).
 * Die fachlichen Zeitpläne stehen in der Datenbank — hier steht nur, wie oft
 * überhaupt geprüft wird.
 */
export const CRON = {
  /** Jede Minute: fällige Agenten-Zeitpläne. */
  [QUEUES.scheduleTick]: "* * * * *",
  /** Alle 15 Minuten: wer eine Tageszusammenfassung erwartet. */
  [QUEUES.digest]: "*/15 * * * *",
  /** Täglich 03:10 UTC: Abrechnung für abgeschlossene Perioden. */
  [QUEUES.billing]: "10 3 * * *",
  /** Alle 10 Minuten: abgelaufene Freigaben schließen. */
  [QUEUES.approvalExpiry]: "*/10 * * * *",
} as const;

/** Nach so vielen Fehlläufen in Folge wird ein Zeitplan abgeschaltet. */
export const MAX_CONSECUTIVE_FAILURES = 5;
