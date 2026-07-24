import { and, desc, eq, isNull } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import { emailMessage, integration } from "@/server/db/schema";
import type { EmailConnector, InboundEmail, OutboundEmail } from "./types";

/**
 * Demo-E-Mail-Connector: vollständig funktionsfähiges Postfach innerhalb der
 * Plattform. Eingehende Nachrichten liegen in `email_message`; ausgehende
 * werden dort ebenfalls gespeichert und im UI angezeigt — es wird bewusst
 * nichts an echte Empfänger versendet (kein vorgetäuschter Versand).
 */
export class DemoEmailConnector implements EmailConnector {
  readonly key = "demo-email";

  async fetchInbox(
    organizationId: string,
    limit = 20,
  ): Promise<InboundEmail[]> {
    const rows = await withOrg(organizationId, (tx) =>
      tx
        .select()
        .from(emailMessage)
        .where(
          and(
            eq(emailMessage.direction, "inbound"),
            eq(emailMessage.status, "received"),
          ),
        )
        .orderBy(desc(emailMessage.receivedAt))
        .limit(limit),
    );
    return rows.map((r) => ({
      externalId: r.id,
      from: r.fromAddress,
      to: r.toAddress,
      subject: r.subject,
      body: r.body,
      receivedAt: r.receivedAt ?? r.createdAt,
    }));
  }

  /** Noch nicht triagierte eingehende Nachrichten (für den Triage-Agenten). */
  async fetchUntriaged(organizationId: string, limit = 10) {
    return withOrg(organizationId, (tx) =>
      tx
        .select()
        .from(emailMessage)
        .where(
          and(
            eq(emailMessage.direction, "inbound"),
            eq(emailMessage.status, "received"),
            isNull(emailMessage.triagedAt),
          ),
        )
        .orderBy(desc(emailMessage.receivedAt))
        .limit(limit),
    );
  }

  async send(
    organizationId: string,
    message: OutboundEmail,
  ): Promise<{ id: string; delivered: boolean }> {
    const [integrationRow] = await withOrg(organizationId, (tx) =>
      tx
        .select({ id: integration.id })
        .from(integration)
        .where(eq(integration.connectorKey, this.key)),
    );
    const [row] = await withOrg(organizationId, (tx) =>
      tx
        .insert(emailMessage)
        .values({
          organizationId,
          integrationId: integrationRow?.id ?? null,
          direction: "outbound",
          status: "sent",
          fromAddress: "team@demo-organisation.de",
          toAddress: message.to,
          subject: message.subject,
          body: message.body,
          sentAt: new Date(),
          inReplyToId: message.inReplyToId ?? null,
          demo: true,
        })
        .returning({ id: emailMessage.id }),
    );
    // "delivered: false" ist ehrlich: die Nachricht liegt im Demo-Postfach,
    // sie verlässt die Plattform nicht.
    return { id: row!.id, delivered: false };
  }
}

export const demoEmailConnector = new DemoEmailConnector();
