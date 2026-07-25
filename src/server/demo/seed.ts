import { eq } from "drizzle-orm";
import { adminDb, withOrg } from "@/server/db/client";
import {
  absence,
  agentInstance,
  calendarEvent,
  contact,
  deal,
  emailMessage,
  employee,
  integration,
  member,
  organization,
  ticket,
} from "@/server/db/schema";
import { getAgentDefinition } from "@/server/agents/catalog";
import { ingestDocument } from "@/server/knowledge/service";
import { recordAudit } from "@/server/audit";

/**
 * Demo-Modus (Spec §28): erzeugt für eine Organisation realistische, klar
 * gekennzeichnete Seed-Daten — ein B2B-Dienstleister mit 25 Mitarbeitenden.
 * Alle erzeugten Datensätze tragen `demo: true` bzw. den Präfix „[Demo]",
 * damit sie niemals mit Produktivdaten verwechselt werden.
 */

const DEMO_AGENTS = [
  "chief-of-staff",
  "email-triage",
  "task",
  "meeting-preparation",
  "follow-up",
  "company-memory",
  "invoice-intake",
] as const;

const DEMO_EMAILS = [
  {
    from: "einkauf@meier-bau.de",
    subject: "Rückfrage zu Ihrem Angebot AN-2026-114",
    body: "Guten Tag,\n\nvielen Dank für Ihr Angebot. Wir haben noch Rückfragen zu den Wartungspauschalen und benötigen eine Aufstellung bis 20.09.2026. Außerdem bitte klären, ob die Schulung im Preis enthalten ist.\n\nMit freundlichen Grüßen\nS. Meier, Meier Bau GmbH",
  },
  {
    from: "buchhaltung@cloudparts.de",
    subject: "Rechnung RE-2026-0915",
    body: "Sehr geehrte Damen und Herren,\n\nanbei unsere Rechnung.\n\nCloudParts GmbH\nRechnungsnummer: RE-2026-0915\nRechnungsdatum: 01.09.2026\nGesamtbetrag: 2.380,00 EUR\nIBAN: DE89370400440532013000\nZahlbar bis 30.09.2026\n\nMit freundlichen Grüßen",
  },
  {
    from: "support-kunde@nordlicht-media.de",
    subject: "DRINGEND: Portal seit heute früh nicht erreichbar",
    body: "Guten Morgen,\n\nunser Kundenportal ist seit heute 07:30 Uhr nicht erreichbar. Wir haben dringend Kundentermine und brauchen sofort eine Rückmeldung. Bitte melden Sie sich heute noch.\n\nViele Grüße\nT. Bergmann, Nordlicht Media",
  },
  {
    from: "info@gewinnbenachrichtigung-express.net",
    subject: "Ihr Konto wurde gesperrt - bitte sofort verifizieren",
    body: "Sehr geehrter Kunde,\n\nIhr Konto wurde gesperrt. Bitte bestätigen Sie umgehend Ihr Passwort über den beigefügten Link. Zusätzlich benötigen wir Gutscheinkarten zur Verifizierung. Neue Bankverbindung beachten: IBAN geändert.\n\nIhr Service-Team",
  },
  {
    from: "anna.krueger@webagentur-krueger.de",
    subject: "Terminvorschlag Strategiegespräch",
    body: "Hallo,\n\ngerne würde ich das Strategiegespräch nächste Woche führen. Bitte senden Sie mir bis 18.09.2026 zwei Terminvorschläge und bereiten Sie die Zahlen aus Q2 vor.\n\nBeste Grüße\nAnna Krüger",
  },
] as const;

const DEMO_KNOWLEDGE = [
  {
    title: "[Demo] Servicevertrag — Allgemeine Bedingungen",
    filename: "demo-servicevertrag.md",
    content: `# Servicevertrag — Allgemeine Bedingungen (Demo)

## Kündigungsfristen
Verträge können mit einer Frist von drei Monaten zum Ende des Kalenderjahres gekündigt werden. Abweichungen bedürfen der Schriftform. Bei Rahmenverträgen ab 50.000 EUR Jahresvolumen gilt eine Frist von sechs Monaten.

## Reaktionszeiten im Support
Für Störungen der Prioritätsstufe 1 (Totalausfall) gilt eine Reaktionszeit von zwei Stunden innerhalb der Servicezeiten Montag bis Freitag, 08:00 bis 18:00 Uhr. Priorität 2 wird innerhalb von acht Stunden bearbeitet, Priorität 3 innerhalb von zwei Werktagen.

## Preisanpassungen
Die Preisliste wird jährlich zum 1. Januar aktualisiert. Preiserhöhungen werden mindestens acht Wochen vorher schriftlich angekündigt und dürfen fünf Prozent pro Jahr nicht überschreiten.

## Wartungspauschale
Die monatliche Wartungspauschale beträgt 12 Prozent des Lizenzwertes und umfasst Updates, Sicherheits-Patches sowie zwei Schulungstage pro Jahr.`,
  },
  {
    title: "[Demo] Reisekostenrichtlinie",
    filename: "demo-reisekostenrichtlinie.md",
    content: `# Reisekostenrichtlinie (Demo)

## Genehmigung
Dienstreisen müssen vor Buchung durch die Teamleitung genehmigt werden. Reisen über 1.500 EUR Gesamtkosten benötigen zusätzlich die Freigabe der Geschäftsführung.

## Übernachtung
Erstattet werden Übernachtungskosten bis 140 EUR pro Nacht innerhalb Deutschlands und bis 190 EUR im europäischen Ausland. Frühstück ist enthalten und wird nicht separat erstattet.

## Verkehrsmittel
Bahnfahrten werden in der zweiten Klasse erstattet, ab vier Stunden Fahrtzeit in der ersten Klasse. Flüge sind ab 500 Kilometer Entfernung zulässig, ausschließlich in der Economy-Klasse.

## Belege
Belege sind innerhalb von 30 Tagen nach Reiseende einzureichen. Ohne Beleg erfolgt keine Erstattung. Bewirtungsbelege müssen Anlass und Teilnehmende ausweisen.`,
  },
] as const;

export interface SeedResult {
  emails: number;
  events: number;
  deals: number;
  contacts: number;
  tickets: number;
  employees: number;
  documents: number;
  agents: number;
}

export async function seedDemoData(params: {
  organizationId: string;
  userId: string;
  userLabel: string;
}): Promise<SeedResult> {
  const { organizationId, userId } = params;

  // Integrationen als verbunden markieren (Demo-Connectoren)
  for (const [key, name] of [
    ["demo-email", "Demo-Postfach"],
    ["demo-calendar", "Demo-Kalender"],
  ] as const) {
    await withOrg(organizationId, (tx) =>
      tx
        .insert(integration)
        .values({
          organizationId,
          connectorKey: key,
          status: "connected",
          displayName: name,
          connectedByUserId: userId,
          lastSyncAt: new Date(),
          config: { demo: true },
        })
        .onConflictDoNothing(),
    );
  }

  // E-Mails
  let emails = 0;
  for (const [i, mail] of DEMO_EMAILS.entries()) {
    const inserted = await withOrg(organizationId, (tx) =>
      tx
        .insert(emailMessage)
        .values({
          organizationId,
          direction: "inbound",
          status: "received",
          fromAddress: mail.from,
          toAddress: "team@demo-organisation.de",
          subject: mail.subject,
          body: mail.body,
          receivedAt: new Date(Date.now() - (i + 1) * 3 * 60 * 60 * 1000),
          demo: true,
        })
        .returning({ id: emailMessage.id }),
    );
    if (inserted.length > 0) emails++;
  }

  // Kalendertermine
  const now = Date.now();
  const demoEvents = [
    {
      title: "[Demo] Strategiegespräch Webagentur Krüger",
      description:
        "Erstgespräch war positiv, Angebot versendet. Offene Rückfragen zu Wartungspauschale und Schulungstagen.",
      location: "Videokonferenz",
      startsAt: new Date(now + 26 * 60 * 60 * 1000),
      endsAt: new Date(now + 27 * 60 * 60 * 1000),
      attendees: ["anna.krueger@webagentur-krueger.de", "vertrieb@demo-organisation.de"],
    },
    {
      title: "[Demo] Wöchentliches Teammeeting",
      description: "Statusrunde, offene Aufgaben, Wochenplanung.",
      location: "Besprechungsraum 2",
      startsAt: new Date(now + 50 * 60 * 60 * 1000),
      endsAt: new Date(now + 51 * 60 * 60 * 1000),
      attendees: ["team@demo-organisation.de"],
    },
  ];
  let events = 0;
  for (const evt of demoEvents) {
    const inserted = await withOrg(organizationId, (tx) =>
      tx
        .insert(calendarEvent)
        .values({ organizationId, demo: true, ...evt })
        .returning({ id: calendarEvent.id }),
    );
    if (inserted.length > 0) events++;
  }

  // Deals mit offenen Angeboten (Follow-up-Szenario)
  const demoDeals = [
    {
      name: "[Demo] Wartungsvertrag Meier Bau",
      company: "Meier Bau GmbH",
      contactEmail: "einkauf@meier-bau.de",
      stage: "angebot_versendet",
      valueCents: 2_400_000,
      proposalSentAt: new Date(now - 21 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(now - 21 * 24 * 60 * 60 * 1000),
      notes: "Angebot AN-2026-114 versendet, Rückfragen zu Wartungspauschalen offen.",
    },
    {
      name: "[Demo] Relaunch Nordlicht Media",
      company: "Nordlicht Media",
      contactEmail: "einkauf@nordlicht-media.de",
      stage: "angebot_versendet",
      valueCents: 1_180_000,
      proposalSentAt: new Date(now - 12 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(now - 12 * 24 * 60 * 60 * 1000),
      notes: "Angebot versendet, seitdem keine Rückmeldung.",
    },
    {
      name: "[Demo] Pilotprojekt Krüger",
      company: "Webagentur Krüger",
      contactEmail: "anna.krueger@webagentur-krueger.de",
      stage: "angebot_versendet",
      valueCents: 640_000,
      proposalSentAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(now - 1 * 24 * 60 * 60 * 1000),
      notes: "Kürzlich versendet — noch innerhalb der üblichen Reaktionszeit.",
    },
    {
      name: "[Demo] Rahmenvertrag Südwerk (Sperrvermerk)",
      company: "Südwerk AG",
      contactEmail: "einkauf@suedwerk.de",
      stage: "angebot_versendet",
      valueCents: 5_600_000,
      proposalSentAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(now - 40 * 24 * 60 * 60 * 1000),
      doNotContact: true,
      notes:
        "Sperrvermerk: laufende Vertragsverhandlung über die Rechtsabteilung — keine automatische Ansprache.",
    },
  ];
  let deals = 0;
  for (const d of demoDeals) {
    const inserted = await withOrg(organizationId, (tx) =>
      tx
        .insert(deal)
        .values({ organizationId, demo: true, ...d })
        .returning({ id: deal.id }),
    );
    if (inserted.length > 0) deals++;
  }

  /*
   * Kontakte, Tickets und Personalstammdaten.
   *
   * Die Datensätze sind so gewählt, dass die zugehörigen Agenten etwas zu
   * arbeiten haben: ein überfälliges Ticket, ein gesperrter Kontakt, ein
   * offener Urlaubsantrag. Ohne solche Fälle liefe ein Demo-Lauf ins Leere.
   */
  let contacts = 0;
  for (const c of [
    {
      fullName: "[Demo] Sabine Meier",
      email: "einkauf@meier-bau.de",
      company: "Meier Bau GmbH",
      role: "Einkaufsleitung",
      kind: "kunde",
      notes: "Fragt regelmäßig nach Wartungspauschalen.",
    },
    {
      fullName: "[Demo] Thomas Bergmann",
      email: "support-kunde@nordlicht-media.de",
      company: "Nordlicht Media",
      role: "IT-Leitung",
      kind: "kunde",
    },
    {
      fullName: "[Demo] Anna Krüger",
      email: "anna.krueger@webagentur-krueger.de",
      company: "Webagentur Krüger",
      role: "Geschäftsführung",
      kind: "lead",
    },
    {
      fullName: "[Demo] Einkauf Südwerk (Sperrvermerk)",
      email: "einkauf@suedwerk.de",
      company: "Südwerk AG",
      kind: "kunde",
      doNotContact: true,
      notes:
        "Sperrvermerk: Ansprache ausschließlich über die Rechtsabteilung. Kein Agent darf hier eine Nachricht vorbereiten.",
    },
  ]) {
    const inserted = await withOrg(organizationId, (tx) =>
      tx
        .insert(contact)
        .values({ organizationId, demo: true, ...c })
        .onConflictDoNothing()
        .returning({ id: contact.id }),
    );
    if (inserted.length > 0) contacts++;
  }

  let tickets = 0;
  const year = new Date().getFullYear();
  for (const [index, t] of [
    {
      subject: "[Demo] Portal seit heute früh nicht erreichbar",
      body: "Unser Kundenportal ist seit 07:30 Uhr nicht erreichbar. Wir haben dringend Kundentermine.",
      requesterEmail: "support-kunde@nordlicht-media.de",
      status: "neu",
      priority: "urgent",
      // Bewusst in der Vergangenheit: erzeugt einen überfälligen Fall.
      dueAt: new Date(now - 4 * 60 * 60 * 1000),
    },
    {
      subject: "[Demo] Rechnung R-2291 doppelt abgebucht",
      body: "Die Rechnung R-2291 vom 3. Juli wurde zweimal belastet. Bitte um Rückerstattung.",
      requesterEmail: "einkauf@meier-bau.de",
      status: "in_bearbeitung",
      priority: "high",
      category: "abrechnung",
      assignedTeam: "Buchhaltung",
      dueAt: new Date(now + 20 * 60 * 60 * 1000),
      firstResponseAt: new Date(now - 2 * 60 * 60 * 1000),
    },
    {
      subject: "[Demo] Frage zur Schulungsbuchung",
      body: "Ist die Einführungsschulung im Wartungspaket enthalten?",
      requesterEmail: "anna.krueger@webagentur-krueger.de",
      status: "geloest",
      priority: "normal",
      category: "vertrieb",
      assignedTeam: "Vertrieb",
      firstResponseAt: new Date(now - 3 * 24 * 60 * 60 * 1000),
      resolvedAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      satisfaction: 5,
    },
  ].entries()) {
    const inserted = await withOrg(organizationId, (tx) =>
      tx
        .insert(ticket)
        .values({
          organizationId,
          demo: true,
          reference: `T-${year}-${String(9900 + index).padStart(4, "0")}`,
          ...t,
        })
        .onConflictDoNothing()
        .returning({ id: ticket.id }),
    );
    if (inserted.length > 0) tickets++;
  }

  let employees = 0;
  const demoEmployees = [
    {
      fullName: "[Demo] Jana Hoffmann",
      workEmail: "j.hoffmann@demo-dienstleister.de",
      jobTitle: "Projektleitung",
      department: "Operations",
      vacationDaysPerYear: 30,
      startDate: new Date(now - 900 * 24 * 60 * 60 * 1000),
    },
    {
      fullName: "[Demo] Kemal Yildiz",
      workEmail: "k.yildiz@demo-dienstleister.de",
      jobTitle: "Sachbearbeitung Buchhaltung",
      department: "Finance",
      vacationDaysPerYear: 28,
      startDate: new Date(now - 400 * 24 * 60 * 60 * 1000),
    },
    {
      fullName: "[Demo] Neue Kollegin (Eintritt geplant)",
      workEmail: "neu@demo-dienstleister.de",
      jobTitle: "Kundenbetreuung",
      department: "Customer Service",
      status: "eintritt_geplant",
      vacationDaysPerYear: 30,
      startDate: new Date(now + 21 * 24 * 60 * 60 * 1000),
    },
  ];
  for (const e of demoEmployees) {
    const inserted = await withOrg(organizationId, (tx) =>
      tx
        .insert(employee)
        .values({ organizationId, demo: true, ...e })
        .onConflictDoNothing()
        .returning({ id: employee.id }),
    );
    if (inserted.length > 0) employees++;
  }

  // Ein offener Antrag — Status "beantragt", damit die formale Prüfung etwas
  // zu tun hat und die Entscheidung sichtbar beim Menschen liegt.
  const [antragsteller] = await withOrg(organizationId, (tx) =>
    tx
      .select({ id: employee.id })
      .from(employee)
      .where(eq(employee.workEmail, "j.hoffmann@demo-dienstleister.de")),
  );
  if (antragsteller) {
    await withOrg(organizationId, (tx) =>
      tx.insert(absence).values({
        organizationId,
        demo: true,
        employeeId: antragsteller.id,
        kind: "urlaub",
        startDate: new Date(now + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(now + 44 * 24 * 60 * 60 * 1000),
        workingDays: 10,
        status: "beantragt",
      }),
    );
  }

  // Wissensdokumente
  let documents = 0;
  for (const doc of DEMO_KNOWLEDGE) {
    await ingestDocument({
      organizationId,
      userId,
      userLabel: params.userLabel,
      filename: doc.filename,
      mimeType: "text/markdown",
      buffer: Buffer.from(doc.content, "utf-8"),
      title: doc.title,
    });
    documents++;
  }

  // Agenten einstellen (Sandbox-Modus, wie bei echten Buchungen)
  let agents = 0;
  for (const slug of DEMO_AGENTS) {
    const def = getAgentDefinition(slug);
    if (!def) continue;
    const inserted = await withOrg(organizationId, (tx) =>
      tx
        .insert(agentInstance)
        .values({
          organizationId,
          definitionSlug: def.slug,
          displayName: def.personaName,
          status: "sandbox",
          allowedTools: [
            ...new Set(def.capabilities.flatMap((c) => c.requiredTools)),
          ],
          responsibleUserId: userId,
        })
        .onConflictDoNothing()
        .returning({ id: agentInstance.id }),
    );
    if (inserted.length > 0) agents++;
  }

  await recordAudit({
    organizationId,
    actorType: "user",
    actorId: userId,
    actorLabel: params.userLabel,
    action: "demo.seeded",
    summary: `Demo-Daten erzeugt: ${emails} E-Mails, ${events} Termine, ${deals} Deals, ${contacts} Kontakte, ${tickets} Tickets, ${employees} Beschäftigte, ${documents} Dokumente, ${agents} Agenten. Alle Datensätze sind als Demo gekennzeichnet.`,
  });

  return { emails, events, deals, contacts, tickets, employees, documents, agents };
}

/** Entfernt alle Demo-Daten einer Organisation. */
export async function clearDemoData(organizationId: string): Promise<void> {
  await withOrg(organizationId, async (tx) => {
    await tx.delete(emailMessage).where(eq(emailMessage.demo, true));
    await tx.delete(calendarEvent).where(eq(calendarEvent.demo, true));
    await tx.delete(deal).where(eq(deal.demo, true));
    await tx.delete(ticket).where(eq(ticket.demo, true));
    await tx.delete(contact).where(eq(contact.demo, true));
    // Abwesenheiten zuerst: sie hängen per Fremdschlüssel an den Beschäftigten.
    await tx.delete(absence).where(eq(absence.demo, true));
    await tx.delete(employee).where(eq(employee.demo, true));
  });
}

/** Prüft, ob eine Organisation Demo-Daten enthält (für UI-Kennzeichnung). */
export async function hasDemoData(organizationId: string): Promise<boolean> {
  const rows = await withOrg(organizationId, (tx) =>
    tx.select({ id: deal.id }).from(deal).where(eq(deal.demo, true)).limit(1),
  );
  return rows.length > 0;
}

/** Hilfsfunktion für das CLI-Seed-Skript: erste Organisation eines Nutzers. */
export async function findOrganizationForEmail(email: string) {
  const { user } = await import("@/server/db/schema");
  const [userRow] = await adminDb
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.email, email));
  if (!userRow) return null;
  const [membership] = await adminDb
    .select({ organizationId: member.organizationId, name: organization.name })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, userRow.id));
  if (!membership) return null;
  return {
    organizationId: membership.organizationId,
    organizationName: membership.name,
    userId: userRow.id,
    userLabel: userRow.name,
  };
}
