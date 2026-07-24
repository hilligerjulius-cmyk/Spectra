import { randomUUID } from "node:crypto";
import { env, providerStatus } from "@/lib/env";
import { adminDb } from "@/server/db/client";
import { mailOutbox } from "@/server/db/schema";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Für Mandantenzuordnung im Outbox-UI (optional bei Auth-Mails vor Org-Zuordnung). */
  organizationId?: string | null;
  category:
    | "auth"
    | "invitation"
    | "notification"
    | "digest"
    | "agent"
    | "billing";
}

export interface MailProvider {
  readonly name: string;
  readonly isReal: boolean;
  send(message: MailMessage): Promise<{ id: string; delivered: boolean }>;
}

/**
 * Outbox-Provider (Standard ohne SMTP_URL): speichert ausgehende Mails in der
 * Datenbank. Sie werden NICHT versendet, sondern im UI (Outbox) angezeigt —
 * transparent statt vorgetäuschtem Versand.
 */
class OutboxMailProvider implements MailProvider {
  readonly name = "outbox";
  readonly isReal = false;

  async send(message: MailMessage) {
    const id = randomUUID();
    await adminDb.insert(mailOutbox).values({
      id,
      organizationId: message.organizationId ?? null,
      recipient: message.to,
      subject: message.subject,
      bodyText: message.text,
      bodyHtml: message.html ?? null,
      category: message.category,
      status: "stored",
      provider: this.name,
    });
    return { id, delivered: false };
  }
}

/** SMTP-Versand über nodemailer; aktiv sobald SMTP_URL gesetzt ist. */
class SmtpMailProvider implements MailProvider {
  readonly name = "smtp";
  readonly isReal = true;

  async send(message: MailMessage) {
    const { createTransport } = await import("nodemailer");
    const transport = createTransport(env.SMTP_URL);
    const id = randomUUID();
    let status = "sent";
    let error: string | null = null;
    try {
      await transport.sendMail({
        from: env.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (err) {
      status = "failed";
      error = err instanceof Error ? err.message : String(err);
    }
    await adminDb.insert(mailOutbox).values({
      id,
      organizationId: message.organizationId ?? null,
      recipient: message.to,
      subject: message.subject,
      bodyText: message.text,
      bodyHtml: message.html ?? null,
      category: message.category,
      status,
      provider: this.name,
      error,
    });
    if (error) throw new Error(`SMTP-Versand fehlgeschlagen: ${error}`);
    return { id, delivered: true };
  }
}

export const mailProvider: MailProvider = providerStatus.smtp
  ? new SmtpMailProvider()
  : new OutboxMailProvider();

export async function sendMail(message: MailMessage) {
  return mailProvider.send(message);
}
