/**
 * Startet den Hintergrund-Worker.
 *
 *   pnpm worker
 *
 * Der Prozess läuft dauerhaft. In einer Deployment-Umgebung gehört er unter
 * eine Prozessverwaltung (systemd, Docker-Restart-Policy, Kubernetes-Deployment),
 * damit er nach einem Absturz neu startet.
 *
 * Mehrere Worker-Prozesse sind erlaubt: Die Taktgeber laufen als `singleton`,
 * und fällige Zeitpläne werden über ein bedingtes UPDATE beansprucht — ein
 * Fenster kann daher auch bei zwei Prozessen nur einmal einreihen.
 */
import { runWorker } from "@/server/jobs/worker";

runWorker().catch((error) => {
  console.error("Worker konnte nicht starten:", error);
  process.exit(1);
});
