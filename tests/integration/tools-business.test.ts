import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Fachwerkzeuge auf den eigenen Datenbeständen (Tickets, Kontakte, Personal).
 *
 * Geprüft wird vor allem, was die Werkzeuge **nicht** tun: keine Personen aus
 * einer E-Mail-Adresse erfinden, keine Sperrvermerke übergehen, keine
 * Personalvorgänge genehmigen, keine Gesundheitsdaten in Läufe tragen und
 * keine unbekannten Referenzen stillschweigend neu anlegen.
 */

let orgId: string;
let userId: string;
let instanceId: string;

async function callTool(key: string, input: unknown, sandbox = false) {
  const { getTool } = await import("@/server/agents/runtime/tools");
  await import("@/server/agents/runtime/tools-init");
  const tool = getTool(key);
  if (!tool) throw new Error(`Werkzeug ${key} nicht registriert`);
  return tool.execute(
    {
      organizationId: orgId,
      instanceId,
      runId: crypto.randomUUID(),
      sandbox,
      requestedByUserId: userId,
    },
    input,
  );
}

beforeAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user, agentInstance } = await import(
    "@/server/db/schema"
  );
  const { getAgentDefinition } = await import("@/server/agents/catalog");

  orgId = crypto.randomUUID();
  userId = crypto.randomUUID();
  await adminDb.insert(user).values({
    id: userId,
    name: "Testperson",
    email: `business-${userId}@example.de`,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await adminDb.insert(organization).values({
    id: orgId,
    name: "Fachtest",
    slug: `fachtest-${orgId.slice(0, 8)}`,
    createdAt: new Date(),
  });

  const def = getAgentDefinition("ticket-routing")!;
  instanceId = crypto.randomUUID();
  await adminDb.insert(agentInstance).values({
    id: instanceId,
    organizationId: orgId,
    definitionSlug: def.slug,
    displayName: def.personaName,
    status: "active",
    allowedTools: ["tickets.read", "tickets.write"],
  });
});

afterAll(async () => {
  const { adminDb } = await import("@/server/db/client");
  const { organization, user } = await import("@/server/db/schema");
  await adminDb.delete(organization).where(eq(organization.id, orgId));
  await adminDb.delete(user).where(eq(user.id, userId));
});

describe("tickets", () => {
  it("legt ein Ticket mit fortlaufender Referenz an", async () => {
    const first = await callTool("tickets.write", {
      subject: "Rechnung doppelt abgebucht",
      body: "Die Rechnung R-2291 wurde zweimal belastet.",
      requesterEmail: "kundin@example.de",
      priority: "high",
      dueInHours: 24,
    });
    const second = await callTool("tickets.write", {
      subject: "Passwort zurücksetzen",
      body: "Ich komme nicht mehr in mein Konto.",
    });

    const refA = (first.data as { reference: string }).reference;
    const refB = (second.data as { reference: string }).reference;
    expect(refA).toMatch(/^T-\d{4}-0001$/);
    expect(refB).toMatch(/^T-\d{4}-0002$/);
  });

  it("legt bei unbekannter Referenz kein neues Ticket an", async () => {
    await expect(
      callTool("tickets.write", {
        reference: "T-1999-9999",
        status: "geloest",
      }),
    ).rejects.toThrow(/existiert nicht/);
  });

  it("setzt erste Reaktion und Lösungszeitpunkt nur beim tatsächlichen Eintritt", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { ticket } = await import("@/server/db/schema");

    const created = await callTool("tickets.write", {
      subject: "Lieferung verspätet",
      body: "Die Bestellung 8842 ist nicht angekommen.",
    });
    const reference = (created.data as { reference: string }).reference;

    await callTool("tickets.write", { reference, status: "in_bearbeitung" });
    const [afterFirst] = await withOrg(orgId, (tx) =>
      tx.select().from(ticket).where(eq(ticket.reference, reference)),
    );
    expect(afterFirst!.firstResponseAt).not.toBeNull();
    expect(afterFirst!.resolvedAt).toBeNull();
    const firstResponse = afterFirst!.firstResponseAt!.getTime();

    await callTool("tickets.write", { reference, status: "geloest" });
    const [afterResolve] = await withOrg(orgId, (tx) =>
      tx.select().from(ticket).where(eq(ticket.reference, reference)),
    );
    expect(afterResolve!.resolvedAt).not.toBeNull();
    // Die erste Reaktion darf nicht überschrieben werden — sie ist eine Messung.
    expect(afterResolve!.firstResponseAt!.getTime()).toBe(firstResponse);
  });

  it("meldet fehlende Angaben statt sie zu ergänzen", async () => {
    await expect(
      callTool("tickets.write", { subject: "Nur ein Betreff" }),
    ).rejects.toThrow(/subject und body/);
  });
});

describe("contacts", () => {
  it("erfindet keinen Namen aus der E-Mail-Adresse", async () => {
    await expect(
      callTool("contacts.write", { email: "unbekannt@example.de" }),
    ).rejects.toThrow(/Name nötig/);
  });

  it("nimmt gesperrte Kontakte standardmäßig nicht in Leseergebnisse auf", async () => {
    await callTool("contacts.write", {
      email: "offen@example.de",
      fullName: "Offene Person",
    });
    await callTool("contacts.write", {
      email: "gesperrt@example.de",
      fullName: "Gesperrte Person",
      setDoNotContact: true,
    });

    const standard = await callTool("contacts.read", {});
    const emails = (standard.data as { email: string | null }[]).map(
      (c) => c.email,
    );
    expect(emails).toContain("offen@example.de");
    expect(emails).not.toContain("gesperrt@example.de");

    const mitGesperrten = await callTool("contacts.read", {
      includeDoNotContact: true,
    });
    expect(
      (mitGesperrten.data as { email: string | null }[]).map((c) => c.email),
    ).toContain("gesperrt@example.de");
  });

  it("hebt einen Sperrvermerk nicht auf", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { contact } = await import("@/server/db/schema");

    // `setDoNotContact: false` darf die Sperre nicht entfernen — das Werkzeug
    // kennt bewusst nur die eine Richtung.
    await callTool("contacts.write", {
      email: "gesperrt@example.de",
      setDoNotContact: false,
      notes: "Versuch, die Sperre zu lösen",
    });
    const [row] = await withOrg(orgId, (tx) =>
      tx.select().from(contact).where(eq(contact.email, "gesperrt@example.de")),
    );
    expect(row!.doNotContact).toBe(true);
  });

  it("aktualisiert einen bestehenden Kontakt statt eine Dublette anzulegen", async () => {
    const result = await callTool("contacts.write", {
      email: "offen@example.de",
      company: "Beispiel GmbH",
      kind: "kunde",
    });
    expect((result.data as { created: boolean }).created).toBe(false);
    expect((result.data as { changed: boolean }).changed).toBe(true);
  });
});

describe("crm", () => {
  it("legt keinen Vorgang an, wenn keiner existiert", async () => {
    await expect(
      callTool("crm.write", {
        contactEmail: "niemand@example.de",
        stage: "gewonnen",
      }),
    ).rejects.toThrow(/Kein Vorgang/);
  });

  it("verändert einen gesperrten Vorgang nicht", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { deal } = await import("@/server/db/schema");
    await adminDb.insert(deal).values({
      organizationId: orgId,
      name: "Gesperrter Vorgang",
      company: "Sperr AG",
      contactEmail: "sperre@example.de",
      doNotContact: true,
    });

    await expect(
      callTool("crm.write", {
        contactEmail: "sperre@example.de",
        stage: "verhandlung",
      }),
    ).rejects.toThrow(/Sperrvermerk/);
  });

  it("weist keine Gesamtsumme aus, wenn ein Betrag fehlt", async () => {
    const { adminDb } = await import("@/server/db/client");
    const { deal } = await import("@/server/db/schema");
    await adminDb.insert(deal).values([
      {
        organizationId: orgId,
        name: "Mit Betrag",
        company: "A GmbH",
        contactEmail: "a@example.de",
        valueCents: 500_000,
      },
      {
        organizationId: orgId,
        name: "Ohne Betrag",
        company: "B GmbH",
        contactEmail: "b@example.de",
        valueCents: null,
      },
    ]);

    const result = await callTool("crm.read", {});
    const d = result.data as {
      totalValueCents: number | null;
      totalValueNote: string | null;
    };
    // Eine Summe über unvollständige Daten wäre irreführend.
    expect(d.totalValueCents).toBeNull();
    expect(d.totalValueNote).toContain("fehlt der Betrag");
  });
});

describe("hr", () => {
  it("legt keine Personalstammdaten an", async () => {
    await expect(
      callTool("hr.write", {
        workEmail: "neu@example.de",
        absence: {
          kind: "urlaub",
          startDate: "2026-08-03",
          endDate: "2026-08-14",
          workingDays: 10,
        },
      }),
    ).rejects.toThrow(/Personalstammdaten entstehen nicht/);
  });

  it("erfasst einen Antrag, genehmigt ihn aber nicht", async () => {
    const { adminDb, withOrg } = await import("@/server/db/client");
    const { employee, absence } = await import("@/server/db/schema");
    await adminDb.insert(employee).values({
      organizationId: orgId,
      fullName: "Antragsteller",
      workEmail: "antrag@example.de",
      vacationDaysPerYear: 30,
    });

    const result = await callTool("hr.write", {
      workEmail: "antrag@example.de",
      absence: {
        kind: "urlaub",
        startDate: "2026-08-03",
        endDate: "2026-08-14",
        workingDays: 10,
      },
      checkResult: { pruefung: "formal" },
    });
    expect((result.data as { status: string }).status).toBe("beantragt");
    expect((result.data as { decided: boolean }).decided).toBe(false);

    const rows = await withOrg(orgId, (tx) => tx.select().from(absence));
    expect(rows).toHaveLength(1);
    // Ein Agent darf einen Personalvorgang nie entscheiden.
    expect(rows[0]!.status).toBe("beantragt");
    expect(rows[0]!.decidedByUserId).toBeNull();
    expect(rows[0]!.decidedAt).toBeNull();
  });

  it("weist ein Enddatum vor dem Startdatum ab", async () => {
    await expect(
      callTool("hr.write", {
        workEmail: "antrag@example.de",
        absence: {
          kind: "urlaub",
          startDate: "2026-08-14",
          endDate: "2026-08-03",
          workingDays: 8,
        },
      }),
    ).rejects.toThrow(/Enddatum liegt vor dem Startdatum/);
  });

  it("gibt keine Abwesenheitsgründe an den Lauf weiter", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { absence } = await import("@/server/db/schema");
    await withOrg(orgId, (tx) =>
      tx.update(absence).set({ note: "Operation am Knie, Reha bis Oktober" }),
    );

    const result = await callTool("hr.read", {
      workEmail: "antrag@example.de",
      includeAbsences: true,
    });
    const serialized = JSON.stringify(result.data);
    // Ein Krankheitsgrund darf nicht in Laufdaten, Entwürfen oder Protokollen
    // landen — er wird gar nicht ausgeliefert.
    expect(serialized).not.toContain("Operation am Knie");
    expect(serialized).not.toContain("Reha");
    // Die formalen Angaben müssen dagegen ankommen.
    expect(serialized).toContain("urlaub");
  });

  it("liefert keine Vergütungs- oder Gesundheitsfelder, weil es keine gibt", async () => {
    const result = await callTool("hr.read", { limit: 10 });
    const serialized = JSON.stringify(result.data).toLowerCase();
    for (const feld of ["gehalt", "salary", "iban", "geburt", "krank"]) {
      expect(serialized).not.toContain(feld);
    }
    expect(result.summary).toContain("Ohne Vergütungs- und Gesundheitsdaten");
  });
});

describe("CSV-Import der neuen Bestände", () => {
  async function runImport(target: string, content: string) {
    const { importCsv } = await import("@/server/integrations/csv");
    return importCsv({
      organizationId: orgId,
      userId,
      userLabel: "Testperson",
      target: target as "contacts" | "tickets" | "employees",
      content,
    });
  }

  it("übernimmt Kontakte und meldet Dubletten statt sie zu überschreiben", async () => {
    const csv = [
      "name;email;firma;art;keine_ansprache",
      "Neue Person;import-neu@example.de;Import GmbH;kunde;",
      // Diese E-Mail existiert schon aus dem contacts-Test.
      "Doppelt;offen@example.de;Andere GmbH;lead;",
      "Gesperrt Importiert;import-sperre@example.de;Sperr GmbH;lead;ja",
    ].join("\n");

    const result = await runImport("contacts", csv);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
    expect(result.problems[0]!.reason).toMatch(/existiert bereits/);

    const { withOrg } = await import("@/server/db/client");
    const { contact } = await import("@/server/db/schema");
    const [gesperrt] = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(contact)
        .where(eq(contact.email, "import-sperre@example.de")),
    );
    // Ein Sperrvermerk aus der Datei muss ankommen.
    expect(gesperrt!.doNotContact).toBe(true);
  });

  it("überspringt Kontaktzeilen mit unbrauchbarer E-Mail-Adresse", async () => {
    const result = await runImport(
      "contacts",
      ["name;email", "Kaputte Adresse;keine-mail-adresse"].join("\n"),
    );
    expect(result.imported).toBe(0);
    expect(result.problems[0]!.reason).toMatch(/keine E-Mail-Adresse/);
  });

  it("vergibt beim Ticket-Import fortlaufende Referenzen ohne Kollision", async () => {
    const { withOrg } = await import("@/server/db/client");
    const { ticket } = await import("@/server/db/schema");
    const before = await withOrg(orgId, (tx) => tx.select().from(ticket));

    const result = await runImport(
      "tickets",
      [
        "betreff;inhalt;prioritaet;status",
        "Importiertes Ticket A;Inhalt A;high;neu",
        "Importiertes Ticket B;Inhalt B;unbekannt;quatsch",
      ].join("\n"),
    );
    expect(result.imported).toBe(2);
    // Ein unbekannter Status wird gemeldet, nicht stillschweigend gesetzt.
    expect(result.problems.some((p) => /Unbekannter Status/.test(p.reason))).toBe(
      true,
    );

    const after = await withOrg(orgId, (tx) => tx.select().from(ticket));
    const refs = after.map((t) => t.reference);
    expect(after.length).toBe(before.length + 2);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("übernimmt Beschäftigte mit deutschem Datumsformat", async () => {
    const result = await runImport(
      "employees",
      [
        "name;email;position;abteilung;eintritt;urlaubstage",
        "Importierte Person;import-hr@example.de;Sachbearbeitung;Verwaltung;01.03.2026;28",
      ].join("\n"),
    );
    expect(result.imported).toBe(1);

    const { withOrg } = await import("@/server/db/client");
    const { employee } = await import("@/server/db/schema");
    const [row] = await withOrg(orgId, (tx) =>
      tx.select().from(employee).where(eq(employee.workEmail, "import-hr@example.de")),
    );
    expect(row!.startDate?.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(row!.vacationDaysPerYear).toBe(28);
  });

  it("nennt fehlende Pflichtspalten statt einen Teilimport zu versuchen", async () => {
    const result = await runImport(
      "tickets",
      ["betreff;prioritaet", "Ohne Inhalt;high"].join("\n"),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Pflichtspalten: inhalt/);
  });
});

describe("files.read", () => {
  it("nennt die Wissensablage als Quelle und behauptet keinen externen Speicher", async () => {
    const result = await callTool("files.read", {});
    const d = result.data as {
      source: string;
      externalStorageConnected: boolean;
    };
    expect(d.source).toBe("knowledge_base");
    expect(d.externalStorageConnected).toBe(false);
    expect(result.summary).toContain("nicht angebunden");
  });
});
