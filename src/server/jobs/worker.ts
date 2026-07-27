import "server-only";
import { registerCronJobs, startBoss, stopBoss } from "./client";
import { registerHandlers } from "./handlers";

/**
 * Worker-Prozess.
 *
 * Ein einzelner, dauerhaft laufender Prozess neben der Anwendung. Er teilt die
 * Datenbank mit ihr, aber nicht den Prozess: Ein Absturz des Workers macht die
 * Anwendung nicht unbenutzbar — Läufe lassen sich weiterhin von Hand starten,
 * nur Zeitpläne ruhen.
 */

let shuttingDown = false;

export async function runWorker(): Promise<void> {
  const boss = await startBoss();
  await registerHandlers(boss);
  await registerCronJobs(boss);

  console.log(
    JSON.stringify({
      scope: "worker",
      at: new Date().toISOString(),
      message: "Worker gestartet",
      hinweis:
        "Zeitpläne, Wiederholungen, Tageszusammenfassungen, Abrechnung und Freigabe-Verfall sind aktiv.",
    }),
  );

  // Geordnetes Herunterfahren: laufende Jobs zu Ende bringen, statt sie
  // mitten in einem Agentenlauf abzuschneiden.
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(
    JSON.stringify({
      scope: "worker",
      at: new Date().toISOString(),
      message: `${signal} empfangen — Worker beendet sich geordnet`,
    }),
  );
  try {
    await stopBoss();
  } catch (error) {
    console.error("[worker] Fehler beim Beenden:", error);
  }
  process.exit(0);
}
