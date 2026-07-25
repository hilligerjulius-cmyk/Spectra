import { afterAll, beforeAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Demo-Daten: erzeugen und restlos entfernen.
 *
 * Der Rücklauf ist der eigentliche Gegenstand. Wird eine neue Tabelle in
 * `seedDemoData()` gefüllt, aber in `clearDemoData()` vergessen, bleiben
 * gekennzeichnete Demo-Datensätze in einer Produktivorganisation zurück — und
 * genau das fällt sonst niemandem auf.
 */

let orgId: string;
let userId: string;

beforeAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  orgId = crypto.randomUUID();
  userId = crypto.randomUUID();
  await adminDb.insert(user).values({
    id: userId,
    name: "Demo-Tester",
    email: `demo-seed-${userId}@example.de`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await adminDb.insert(organization).values({
    id: orgId,
    name: "Demo-Seed-Test",
    slug: `demo-seed-${orgId.slice(0, 8)}`,
    createdAt: new Date(),
  });
});

afterAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  await adminDb.delete(organization).where(eq(organization.id, orgId));
  await adminDb.delete(user).where(eq(user.id, userId));
});

it("erzeugt Demo-Daten in allen Beständen und entfernt sie vollständig", async () => {
  const { seedDemoData, clearDemoData, hasDemoData } = await import(
    "@/server/demo/seed"
  );
  const { withOrg } = await import("@/server/db/client");
  const { contact, ticket, employee, absence, deal, emailMessage } =
    await import("@/server/db/schema");

  const result = await seedDemoData({
    organizationId: orgId,
    userId,
    userLabel: "Demo-Tester",
  });
  expect(result.contacts).toBeGreaterThan(0);
  expect(result.tickets).toBeGreaterThan(0);
  expect(result.employees).toBeGreaterThan(0);
  expect(await hasDemoData(orgId)).toBe(true);

  async function counts() {
    return withOrg(orgId, async (tx) => ({
      contacts: (await tx.select().from(contact)).length,
      tickets: (await tx.select().from(ticket)).length,
      employees: (await tx.select().from(employee)).length,
      absences: (await tx.select().from(absence)).length,
      deals: (await tx.select().from(deal)).length,
      emails: (await tx.select().from(emailMessage)).length,
    }));
  }

  const seeded = await counts();
  for (const [name, value] of Object.entries(seeded)) {
    expect(value, `${name} sollte Demo-Daten enthalten`).toBeGreaterThan(0);
  }

  await clearDemoData(orgId);
  expect(await counts()).toEqual({
    contacts: 0,
    tickets: 0,
    employees: 0,
    absences: 0,
    deals: 0,
    emails: 0,
  });
});

it("enthält Fälle, an denen die Agenten tatsächlich arbeiten können", async () => {
  const { seedDemoData, clearDemoData } = await import("@/server/demo/seed");
  const { withOrg } = await import("@/server/db/client");
  const { contact, ticket, absence } = await import("@/server/db/schema");

  await seedDemoData({
    organizationId: orgId,
    userId,
    userLabel: "Demo-Tester",
  });

  const state = await withOrg(orgId, async (tx) => ({
    tickets: await tx.select().from(ticket),
    contacts: await tx.select().from(contact),
    absences: await tx.select().from(absence),
  }));

  // Ein überfälliger Fall — sonst hat die Eskalation nichts zu erkennen.
  expect(
    state.tickets.some(
      (t) => t.dueAt !== null && t.resolvedAt === null && t.dueAt < new Date(),
    ),
  ).toBe(true);
  // Ein gesperrter Kontakt — sonst wird nie geprüft, ob die Sperre greift.
  expect(state.contacts.some((c) => c.doNotContact)).toBe(true);
  // Ein offener Antrag, der noch von keinem Menschen entschieden wurde.
  expect(
    state.absences.some((a) => a.status === "beantragt" && a.decidedAt === null),
  ).toBe(true);
  // Ein gelöster Fall mit Bewertung — Grundlage für Qualitätskennzahlen.
  expect(state.tickets.some((t) => t.satisfaction !== null)).toBe(true);

  await clearDemoData(orgId);
});
