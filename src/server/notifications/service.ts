import "server-only";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { adminDb, withOrg } from "@/server/db/client";
import {
  member,
  notification,
  notificationPreference,
  organization,
  user,
} from "@/server/db/schema";
import { sendMail, mailProvider } from "@/server/mail";
import { env } from "@/lib/env";

/**
 * Benachrichtigungen: In-App immer, E-Mail nur nach ausdrücklicher Einstellung.
 *
 * Ohne konfigurierten SMTP-Zugang landen E-Mails im nachvollziehbaren
 * Postausgang (Outbox) statt versendet zu werden. Der Unterschied wird in der
 * Oberfläche benannt — es wird kein Versand vorgetäuscht.
 */

export const NOTIFICATION_TYPES = [
  {
    key: "approval_required",
    label: "Freigabe erforderlich",
    description: "Ein Agent hat eine Aktion vorbereitet und wartet auf Ihre Entscheidung.",
    /** Standardmäßig auch per E-Mail — hier hängt Arbeit an einer Entscheidung. */
    emailByDefault: true,
  },
  {
    key: "agent_failed",
    label: "Agentenlauf fehlgeschlagen",
    description: "Ein Lauf konnte nicht abgeschlossen werden.",
    emailByDefault: true,
  },
  {
    key: "risk_detected",
    label: "Risiko erkannt",
    description: "Ein Agent hat eine Auffälligkeit gemeldet.",
    emailByDefault: true,
  },
  {
    key: "task_overdue",
    label: "Aufgabe überfällig",
    description: "Eine Frist wurde überschritten.",
    emailByDefault: false,
  },
  {
    key: "cost_limit",
    label: "Kontingent nahezu ausgeschöpft",
    description: "Läufe oder KI-Kosten nähern sich der Plangrenze.",
    emailByDefault: true,
  },
  {
    key: "integration_disconnected",
    label: "Integration getrennt",
    description: "Eine Datenquelle steht Agenten nicht mehr zur Verfügung.",
    emailByDefault: true,
  },
  {
    key: "workflow_completed",
    label: "Lauf abgeschlossen",
    description: "Ein Agent hat eine Aufgabe erledigt.",
    emailByDefault: false,
  },
  {
    key: "uncertain_classification",
    label: "Unsichere Einordnung",
    description: "Ein Agent konnte einen Vorgang nicht belastbar einordnen.",
    emailByDefault: false,
  },
  {
    key: "agent_paused",
    label: "Agent oder Zeitplan angehalten",
    description:
      "Ein Agent wurde pausiert oder ein Zeitplan nach mehreren Fehlläufen abgeschaltet.",
    /**
     * Standardmäßig per E-Mail: Ein stillgelegter Zeitplan fällt sonst erst
     * auf, wenn jemand das Ergebnis vermisst — und das kann Wochen dauern.
     */
    emailByDefault: true,
  },
  {
    key: "info",
    label: "Allgemeine Hinweise",
    description: "Sonstige Meldungen der Plattform.",
    emailByDefault: false,
  },
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number]["key"];

export const ALL_TYPE_KEYS = NOTIFICATION_TYPES.map((t) => t.key);

/**
 * Dieselben Schlüssel als nicht-leeres Tupel — die Form, die `z.enum()`
 * verlangt. Ersetzt die früheren `as [string, ...string[]]`-Zusicherungen an
 * den Aufrufstellen, die die Typprüfung genau dort aufgehoben haben, wo sie
 * gebraucht wird.
 */
export const NOTIFICATION_TYPE_KEYS = ALL_TYPE_KEYS as [
  NotificationTypeKey,
  ...NotificationTypeKey[],
];
const EMAIL_DEFAULT_KEYS = NOTIFICATION_TYPES.filter(
  (t) => t.emailByDefault,
).map((t) => t.key);

export type PreferenceRow = typeof notificationPreference.$inferSelect;

/** Lädt die Einstellungen; legt beim ersten Aufruf konservative Defaults an. */
export async function getOrCreatePreference(
  organizationId: string,
  userId: string,
): Promise<PreferenceRow> {
  const existing = await withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, userId)),
  );
  if (existing[0]) return existing[0];

  const inserted = await withOrg(organizationId, (tx) =>
    tx
      .insert(notificationPreference)
      .values({
        organizationId,
        userId,
        inAppTypes: [...ALL_TYPE_KEYS],
        emailTypes: [...EMAIL_DEFAULT_KEYS],
      })
      .onConflictDoNothing()
      .returning(),
  );
  if (inserted[0]) return inserted[0];

  const [row] = await withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(notificationPreference)
      .where(eq(notificationPreference.userId, userId)),
  );
  return row!;
}

/**
 * Prüft die Uhrzeit inhaltlich, nicht nur formal: "99:99" hat zwar das
 * richtige Format, ist aber keine Uhrzeit. Ungültige Werte fallen auf 08:00
 * zurück, statt eine nie erreichbare Versandzeit zu speichern.
 */
export function normalizeDigestHour(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return "08:00";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return "08:00";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export async function updatePreference(params: {
  organizationId: string;
  userId: string;
  inAppTypes: string[];
  emailTypes: string[];
  dailyDigest: boolean;
  digestHour: string;
}): Promise<void> {
  await getOrCreatePreference(params.organizationId, params.userId);
  // Nur bekannte Typen übernehmen — der Client darf nichts erfinden.
  const valid = new Set<string>(ALL_TYPE_KEYS);
  await withOrg(params.organizationId, (tx) =>
    tx
      .update(notificationPreference)
      .set({
        inAppTypes: params.inAppTypes.filter((t) => valid.has(t)),
        emailTypes: params.emailTypes.filter((t) => valid.has(t)),
        dailyDigest: params.dailyDigest,
        digestHour: normalizeDigestHour(params.digestHour),
      })
      .where(eq(notificationPreference.userId, params.userId)),
  );
}

export interface NotifyInput {
  organizationId: string;
  userId: string;
  /**
   * Nur deklarierte Typen. Bewusst nicht auf `string` geweitet: Ein Tippfehler
   * soll beim Übersetzen auffallen und nicht erst dadurch, dass die Meldung im
   * Betrieb ausbleibt.
   */
  type: NotificationTypeKey;
  title: string;
  body?: string | null;
  href?: string | null;
  /** Sandbox-Meldungen werden gekennzeichnet und nie per E-Mail versendet. */
  sandbox?: boolean;
}

export interface NotifyResult {
  inApp: boolean;
  email: "sent" | "outbox" | "skipped";
}

/**
 * Stellt eine Benachrichtigung zu.
 * In-App und E-Mail folgen getrennt den Einstellungen der Empfängerin.
 * Bei aktivierter Tageszusammenfassung wird die Einzelmail unterdrückt —
 * die Meldung erscheint dann gebündelt im Digest.
 */
export async function notify(input: NotifyInput): Promise<NotifyResult> {
  /*
   * Ein unbekannter Typ ist ein Programmierfehler, kein Nutzerwunsch.
   *
   * Vorher fiel er durch die Präferenzprüfung und die Meldung verschwand
   * lautlos — genau so ging eine Abschaltmeldung für Zeitpläne verloren, weil
   * `agent_paused` nirgends deklariert war. Ein Wurf macht das in Tests und
   * Logs sichtbar; die Aufrufstellen in der Runtime fangen
   * Benachrichtigungsfehler ohnehin ab, ein Lauf scheitert daran also nicht.
   */
  if (!ALL_TYPE_KEYS.includes(input.type as NotificationTypeKey)) {
    throw new Error(
      `Unbekannter Benachrichtigungstyp "${input.type}". Erlaubt: ${ALL_TYPE_KEYS.join(", ")}.`,
    );
  }

  const pref = await getOrCreatePreference(input.organizationId, input.userId);
  const result: NotifyResult = { inApp: false, email: "skipped" };

  if (pref.inAppTypes.includes(input.type)) {
    await withOrg(input.organizationId, (tx) =>
      tx.insert(notification).values({
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.sandbox ? `[SANDBOX] ${input.title}` : input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      }),
    );
    result.inApp = true;
  }

  const wantsEmail =
    pref.emailTypes.includes(input.type) && !pref.dailyDigest && !input.sandbox;
  if (!wantsEmail) return result;

  const [recipient] = await adminDb
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, input.userId));
  if (!recipient) return result;

  const sent = await sendMail({
    to: recipient.email,
    subject: input.title,
    text: [
      `Hallo ${recipient.name},`,
      "",
      input.body ?? input.title,
      "",
      input.href ? `Direkt öffnen: ${env.APP_URL}${input.href}` : "",
      "",
      "— WORKFORCE OS",
    ]
      .filter(Boolean)
      .join("\n"),
    organizationId: input.organizationId,
    category: "notification",
  });
  result.email = sent.delivered ? "sent" : "outbox";
  return result;
}

/** Benachrichtigt alle Mitglieder, die die Berechtigung für den Anlass haben. */
export async function notifyOrganization(
  input: Omit<NotifyInput, "userId"> & { roles?: string[] },
): Promise<number> {
  const members = await adminDb
    .select({ userId: member.userId, role: member.role })
    .from(member)
    .where(eq(member.organizationId, input.organizationId));
  const targets = input.roles
    ? members.filter((m) => input.roles!.includes(m.role))
    : members;
  for (const target of targets) {
    await notify({ ...input, userId: target.userId });
  }
  return targets.length;
}

export async function listNotifications(
  organizationId: string,
  userId: string,
  limit = 50,
) {
  return withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(notification)
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt))
      .limit(limit),
  );
}

export async function countUnread(
  organizationId: string,
  userId: string,
): Promise<number> {
  const [row] = await withOrg(organizationId, (tx) =>
    tx
      .select({ value: sql<number>`count(*)::int` })
      .from(notification)
      .where(
        and(eq(notification.userId, userId), isNull(notification.readAt)),
      ),
  );
  return row?.value ?? 0;
}

export async function markRead(
  organizationId: string,
  userId: string,
  notificationId?: string,
): Promise<number> {
  const rows = await withOrg(organizationId, (tx) =>
    tx
      .update(notification)
      .set({ readAt: new Date() })
      .where(
        notificationId
          ? and(
              eq(notification.id, notificationId),
              eq(notification.userId, userId),
            )
          : and(eq(notification.userId, userId), isNull(notification.readAt)),
      )
      .returning({ id: notification.id }),
  );
  return rows.length;
}

/* -------------------------------------------------------------------------- */
/* Tageszusammenfassung                                                       */
/* -------------------------------------------------------------------------- */

export interface DigestResult {
  userId: string;
  items: number;
  delivered: boolean;
  skippedReason?: string;
}

/**
 * Erstellt die Tageszusammenfassung für eine Person aus den ungelesenen
 * Meldungen seit dem letzten Versand. Ohne neue Meldungen wird nichts
 * verschickt — eine leere Zusammenfassung ist kein Mehrwert.
 */
export async function sendDigest(
  organizationId: string,
  userId: string,
): Promise<DigestResult> {
  const pref = await getOrCreatePreference(organizationId, userId);
  if (!pref.dailyDigest) {
    return {
      userId,
      items: 0,
      delivered: false,
      skippedReason: "Tageszusammenfassung ist für diese Person nicht aktiviert.",
    };
  }

  const since =
    pref.lastDigestAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const items = await withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(notification)
      .where(
        and(
          eq(notification.userId, userId),
          gte(notification.createdAt, since),
        ),
      )
      .orderBy(desc(notification.createdAt))
      .limit(100),
  );

  const relevant = items.filter((i) => pref.emailTypes.includes(i.type));
  if (relevant.length === 0) {
    return {
      userId,
      items: 0,
      delivered: false,
      skippedReason: "Keine neuen Meldungen seit der letzten Zusammenfassung.",
    };
  }

  const [recipient] = await adminDb
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, userId));
  const [org] = await adminDb
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId));
  if (!recipient) {
    return { userId, items: 0, delivered: false, skippedReason: "Empfängerin nicht gefunden." };
  }

  const grouped = new Map<string, typeof relevant>();
  for (const item of relevant) {
    grouped.set(item.type, [...(grouped.get(item.type) ?? []), item]);
  }

  const body = [
    `Hallo ${recipient.name},`,
    "",
    `Zusammenfassung für ${org?.name ?? "Ihre Organisation"} — ${relevant.length} Meldung(en):`,
    "",
    ...[...grouped.entries()].flatMap(([type, list]) => {
      const label =
        NOTIFICATION_TYPES.find((t) => t.key === type)?.label ?? type;
      return [
        `${label} (${list.length})`,
        ...list.slice(0, 10).map((i) => `  - ${i.title}`),
        "",
      ];
    }),
    `Alle Meldungen: ${env.APP_URL}/app/notifications`,
    "",
    "— WORKFORCE OS",
  ].join("\n");

  const sent = await sendMail({
    to: recipient.email,
    subject: `Zusammenfassung: ${relevant.length} Meldung(en)`,
    text: body,
    organizationId,
    category: "digest",
  });

  await withOrg(organizationId, (tx) =>
    tx
      .update(notificationPreference)
      .set({ lastDigestAt: new Date() })
      .where(eq(notificationPreference.userId, userId)),
  );

  return { userId, items: relevant.length, delivered: sent.delivered };
}

/** Kennzeichnung für die Oberfläche: Wird tatsächlich versendet? */
export function mailProviderInfo() {
  return {
    name: mailProvider.name,
    isReal: mailProvider.isReal,
    note: mailProvider.isReal
      ? "E-Mails werden über den konfigurierten SMTP-Server versendet."
      : "Ohne konfigurierten SMTP-Zugang werden E-Mails nicht versendet, sondern im Postausgang gespeichert und dort einsehbar.",
  };
}
