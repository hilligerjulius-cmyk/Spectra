import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createHmac } from "node:crypto";

/**
 * Webhook-Eingang gegen die Test-DB.
 *
 * Belegt: Nur korrekt signierte Aufrufe erzeugen einen Vorgang, das
 * Geheimnis liegt verschlüsselt in der Datenbank, und ein Geheimnis der
 * einen Organisation taugt nicht für eine andere.
 */

const orgA = `wh-org-a-${Date.now()}`;
const orgB = `wh-org-b-${Date.now()}`;
const userId = `wh-user-${Date.now()}`;

let secretA = "";

/**
 * Signaturbildung wie beim Absender: HMAC-SHA256 über "<timestamp>.<body>".
 * Bewusst hier nachgebaut statt die Produktionsfunktion aufzurufen — so
 * prüft der Test die dokumentierte Schnittstelle, nicht sich selbst.
 */
function sign(secret: string, body: string, timestampSeconds: number) {
  return createHmac("sha256", secret)
    .update(`${timestampSeconds}.${body}`)
    .digest("hex");
}

beforeAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  await adminDb.insert(organization).values([
    { id: orgA, name: "Webhook Org A", slug: orgA, createdAt: new Date() },
    { id: orgB, name: "Webhook Org B", slug: orgB, createdAt: new Date() },
  ]);
  await adminDb.insert(user).values({
    id: userId,
    name: "Webhook Tester",
    email: `${userId}@example.com`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

afterAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  await adminDb.delete(organization).where(eq(organization.id, orgA));
  await adminDb.delete(organization).where(eq(organization.id, orgB));
  await adminDb.delete(user).where(eq(user.id, userId));
});

describe("Webhook-Connector", () => {
  it("legt das Geheimnis nur verschlüsselt ab", async () => {
    const { rotateWebhookSecret } =
      await import("@/server/integrations/webhook");
    const { withOrg } = await import("@/server/db/client");
    const { integration } = await import("@/server/db/schema");

    const setup = await rotateWebhookSecret({
      organizationId: orgA,
      userId,
      userLabel: "Webhook Tester",
    });
    expect(setup.secret).toMatch(/^whsec_/);
    secretA = setup.secret!;

    const [row] = await withOrg(orgA, (tx) =>
      tx
        .select()
        .from(integration)
        .where(eq(integration.connectorKey, "webhook")),
    );
    const stored = JSON.stringify(row!.config);
    // Der Klartext darf nirgends in der gespeicherten Konfiguration stehen.
    expect(stored).not.toContain(secretA);
    expect(stored).toContain("v1:");
  });

  it("gibt das Geheimnis später nicht mehr im Klartext heraus", async () => {
    const { getWebhookSetup } = await import("@/server/integrations/webhook");
    const setup = await getWebhookSetup(orgA);
    expect(setup).not.toBeNull();
    expect(setup!.secret).toBeUndefined();
    expect(setup!.secretMasked).toContain("…");
    expect(setup!.url).toContain(orgA);
  });

  it("nimmt einen korrekt signierten Aufruf an und legt eine Aufgabe an", async () => {
    const { handleWebhook } = await import("@/server/integrations/webhook");
    const { withOrg } = await import("@/server/db/client");
    const { task } = await import("@/server/db/schema");

    const body = JSON.stringify({
      event: "invoice.received",
      title: "Rechnung RE-2026-0815 prüfen",
      description: "Eingang aus dem Fremdsystem.",
      priority: "high",
      data: { betrag: "1190.00" },
    });
    const ts = Math.floor(Date.now() / 1000);

    const result = await handleWebhook({
      organizationId: orgA,
      rawBody: body,
      signature: sign(secretA, body, ts),
      timestamp: String(ts),
    });

    expect(result.status).toBe(202);
    expect(result.body.ok).toBe(true);

    const tasks = await withOrg(orgA, (tx) => tx.select().from(task));
    const created = tasks.find((t) => t.id === result.body.taskId);
    expect(created).toBeDefined();
    expect(created!.title).toBe("Rechnung RE-2026-0815 prüfen");
    expect(created!.priority).toBe("high");
    expect(created!.createdByType).toBe("system");
    expect((created!.source as { event: string }).event).toBe(
      "invoice.received",
    );
  });

  it("weist eine falsche Signatur ab, ohne einen Vorgang anzulegen", async () => {
    const { handleWebhook } = await import("@/server/integrations/webhook");
    const { withOrg } = await import("@/server/db/client");
    const { task } = await import("@/server/db/schema");

    const before = await withOrg(orgA, (tx) => tx.select().from(task));
    const body = JSON.stringify({
      event: "x",
      title: "Sollte nicht entstehen",
    });
    const ts = Math.floor(Date.now() / 1000);

    const result = await handleWebhook({
      organizationId: orgA,
      rawBody: body,
      signature: sign("whsec_falsches_geheimnis", body, ts),
      timestamp: String(ts),
    });

    expect(result.status).toBe(401);
    // Die Antwort verrät nicht, woran es lag.
    expect(result.body.message).not.toMatch(/geheimnis|secret/i);

    const after = await withOrg(orgA, (tx) => tx.select().from(task));
    expect(after.length).toBe(before.length);
  });

  it("weist Aufrufe ohne Signaturkopfzeilen ab", async () => {
    const { handleWebhook } = await import("@/server/integrations/webhook");
    const result = await handleWebhook({
      organizationId: orgA,
      rawBody: JSON.stringify({ event: "x", title: "Ohne Signatur" }),
      signature: null,
      timestamp: null,
    });
    expect(result.status).toBe(401);
  });

  it("akzeptiert das Geheimnis einer Organisation nicht für eine andere", async () => {
    const { handleWebhook, rotateWebhookSecret } =
      await import("@/server/integrations/webhook");
    await rotateWebhookSecret({
      organizationId: orgB,
      userId,
      userLabel: "Webhook Tester",
    });

    const body = JSON.stringify({ event: "x", title: "Fremdes Geheimnis" });
    const ts = Math.floor(Date.now() / 1000);
    const result = await handleWebhook({
      organizationId: orgB,
      rawBody: body,
      signature: sign(secretA, body, ts), // Geheimnis von Org A
      timestamp: String(ts),
    });
    expect(result.status).toBe(401);
  });

  it("weist Nutzlasten ab, die nicht dem Schema entsprechen", async () => {
    const { handleWebhook } = await import("@/server/integrations/webhook");
    const body = JSON.stringify({ event: "x" }); // "title" fehlt
    const ts = Math.floor(Date.now() / 1000);
    const result = await handleWebhook({
      organizationId: orgA,
      rawBody: body,
      signature: sign(secretA, body, ts),
      timestamp: String(ts),
    });
    expect(result.status).toBe(400);
    expect(result.body.message).toContain("title");
  });

  it("weist eine Organisation ohne eingerichteten Webhook ab", async () => {
    const { handleWebhook } = await import("@/server/integrations/webhook");
    const body = JSON.stringify({ event: "x", title: "Kein Webhook" });
    const ts = Math.floor(Date.now() / 1000);
    const result = await handleWebhook({
      organizationId: "gibt-es-nicht",
      rawBody: body,
      signature: sign(secretA, body, ts),
      timestamp: String(ts),
    });
    expect(result.status).toBe(404);
  });
});

describe("CSV-Import gegen die Datenbank", () => {
  it("übernimmt gültige Zeilen und benennt fehlerhafte einzeln", async () => {
    const { importCsv } = await import("@/server/integrations/csv");
    const { withOrg } = await import("@/server/db/client");
    const { task } = await import("@/server/db/schema");

    const before = await withOrg(orgA, (tx) => tx.select().from(task));

    const csv = [
      "titel;beschreibung;faellig_am;prioritaet",
      "Angebot nachfassen;Kunde Beispiel GmbH;30.09.2026;high",
      ";Ohne Titel;01.10.2026;normal",
      "Rechnung prüfen;;kein-datum;urgent",
    ].join("\n");

    const result = await importCsv({
      organizationId: orgA,
      userId,
      userLabel: "Webhook Tester",
      target: "tasks",
      content: csv,
    });

    expect(result.imported).toBe(2);
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    // Beide Auffälligkeiten werden mit Zeilennummer benannt.
    expect(result.problems.some((p) => p.reason.includes("titel"))).toBe(true);
    expect(result.problems.some((p) => p.reason.includes("kein-datum"))).toBe(
      true,
    );

    const after = await withOrg(orgA, (tx) => tx.select().from(task));
    expect(after.length).toBe(before.length + 2);
    const imported = after.find((t) => t.title === "Angebot nachfassen");
    expect(imported!.priority).toBe("high");
    expect(imported!.dueAt?.toISOString().slice(0, 10)).toBe("2026-09-30");
  });

  it("lehnt Dateien ohne Pflichtspalten ab, ohne etwas zu schreiben", async () => {
    const { importCsv } = await import("@/server/integrations/csv");
    const result = await importCsv({
      organizationId: orgA,
      userId,
      userLabel: "Webhook Tester",
      target: "deals",
      content: "spalte_a;spalte_b\n1;2",
    });
    expect(result.ok).toBe(false);
    expect(result.imported).toBe(0);
    expect(result.message).toContain("Pflichtspalten");
  });

  it("exportiert nur Daten der eigenen Organisation", async () => {
    const { exportCsv } = await import("@/server/integrations/csv");
    const exportA = await exportCsv({ organizationId: orgA, target: "tasks" });
    const exportB = await exportCsv({ organizationId: orgB, target: "tasks" });

    expect(exportA.rowCount).toBeGreaterThan(0);
    expect(exportB.rowCount).toBe(0);
    expect(exportA.content).toContain("Angebot nachfassen");
    expect(exportB.content).not.toContain("Angebot nachfassen");
    expect(exportA.filename).toMatch(/^aufgaben-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
