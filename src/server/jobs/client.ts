import "server-only";
import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";
import { CRON, QUEUE_CONFIG, QUEUES, type QueueName } from "./queues";

/**
 * pg-boss-Anbindung.
 *
 * Zwei Entscheidungen, die im Betrieb zählen:
 *
 * 1. **Eigenes Schema `pgboss`.** Die Warteschlangentabellen bleiben von den
 *    Anwendungstabellen getrennt — `drizzle-kit` sieht sie nicht und erzeugt
 *    keine Migration, die sie löschen würde.
 *
 * 2. **Owner-Rolle.** pg-boss legt Tabellen an und braucht dafür Rechte, die
 *    die App-Rolle bewusst nicht hat. Warteschlangeneinträge sind
 *    organisationsübergreifend; die Mandantentrennung greift eine Ebene
 *    darunter, sobald ein Job seine Arbeit über `withOrg()` erledigt.
 */

let boss: PgBoss | null = null;
let started = false;

export function getBoss(): PgBoss {
  if (boss === null) {
    boss = new PgBoss({
      connectionString: env.DATABASE_ADMIN_URL,
      schema: "pgboss",
      application_name: "workforce-worker",
      // Der Worker ist ein einzelner Prozess; mehr als vier Verbindungen
      // braucht er nicht und nimmt sie der Anwendung sonst weg.
      max: 4,
    });
    boss.on("error", (error) => {
      console.error("[worker] pg-boss-Fehler:", error);
    });
  }
  return boss;
}

/**
 * Startet pg-boss und legt alle Warteschlangen an. In pg-boss 12 müssen
 * Warteschlangen vor dem ersten `send`/`work` existieren — ein `send` auf eine
 * unbekannte Warteschlange schlägt fehl.
 */
export async function startBoss(): Promise<PgBoss> {
  const instance = getBoss();
  if (started) return instance;
  await instance.start();
  for (const name of queueCreationOrder()) {
    await instance.createQueue(name, QUEUE_CONFIG[name]);
  }
  started = true;
  return instance;
}

/**
 * Reihenfolge, in der die Warteschlangen angelegt werden.
 *
 * pg-boss verlangt, dass eine als `deadLetter` verwiesene Warteschlange bereits
 * existiert. Die Reihenfolge wird deshalb aus der Konfiguration abgeleitet und
 * nicht der Schlüsselreihenfolge des Objekts überlassen — sonst bricht der
 * Worker beim Start, sobald jemand eine Warteschlange ergänzt.
 */
export function queueCreationOrder(): QueueName[] {
  const all = Object.values(QUEUES) as QueueName[];
  const targets = new Set(
    all
      .map((name) => (QUEUE_CONFIG[name] as { deadLetter?: string }).deadLetter)
      .filter((value): value is string => typeof value === "string"),
  );
  return [
    ...all.filter((name) => targets.has(name)),
    ...all.filter((name) => !targets.has(name)),
  ];
}

export async function stopBoss(): Promise<void> {
  if (boss === null || !started) return;
  // `graceful` lässt laufende Jobs zu Ende gehen, statt sie abzuschneiden.
  await boss.stop({ graceful: true, timeout: 30_000 });
  started = false;
  boss = null;
}

/**
 * Registriert die Taktgeber. Idempotent: `schedule()` überschreibt einen
 * bestehenden Eintrag mit demselben Namen, ein Neustart erzeugt also keine
 * Dubletten.
 */
export async function registerCronJobs(instance: PgBoss): Promise<void> {
  for (const [name, cron] of Object.entries(CRON)) {
    await instance.schedule(name as QueueName, cron, null, { tz: "UTC" });
  }
}

/** Enthält die Datenbank bereits das pg-boss-Schema? */
export async function isBossInstalled(): Promise<boolean> {
  const instance = getBoss();
  return instance.isInstalled();
}
