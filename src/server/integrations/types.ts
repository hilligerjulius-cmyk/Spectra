/**
 * Connector-Interface für alle Integrationen.
 *
 * Drei Implementierungsgrade — im UI klar unterschieden:
 *  - "implemented": vollständig nutzbar (Demo-Connectoren, Webhook, CSV)
 *  - "credentials_required": echter Adapter vorhanden, aber ohne Zugangsdaten
 *    nicht nutzbar (Gmail, Google Calendar)
 *  - "planned": nur Registrierung + Interface, noch nicht implementiert
 */
export type ConnectorStatus =
  | "implemented"
  | "credentials_required"
  | "planned";

export type ConnectorCategory =
  | "email"
  | "calendar"
  | "crm"
  | "files"
  | "accounting"
  | "chat"
  | "generic";

export interface ConnectorDefinition {
  key: string;
  name: string;
  category: ConnectorCategory;
  description: string;
  status: ConnectorStatus;
  /** Welche Tool-Schlüssel dieser Connector bedient. */
  providesTools: string[];
  /** Erforderliche Environment-Variablen (nur bei credentials_required). */
  requiredEnv?: string[];
  /** Hinweis für Nutzer, was zum Aktivieren fehlt. */
  setupNote?: string;
}

export interface InboundEmail {
  externalId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export interface OutboundEmail {
  to: string;
  subject: string;
  body: string;
  inReplyToId?: string | null;
}

export interface CalendarEventInput {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  attendees?: string[];
}

/** E-Mail-Connector: eingehende Nachrichten lesen, ausgehende versenden. */
export interface EmailConnector {
  readonly key: string;
  fetchInbox(organizationId: string, limit?: number): Promise<InboundEmail[]>;
  send(
    organizationId: string,
    message: OutboundEmail,
  ): Promise<{ id: string; delivered: boolean }>;
}

/** Kalender-Connector: Termine lesen und anlegen. */
export interface CalendarConnector {
  readonly key: string;
  listUpcoming(
    organizationId: string,
    withinHours?: number,
  ): Promise<
    {
      id: string;
      title: string;
      description: string | null;
      location: string | null;
      startsAt: Date;
      endsAt: Date;
      attendees: string[];
    }[]
  >;
  create(
    organizationId: string,
    event: CalendarEventInput,
  ): Promise<{ id: string }>;
}
