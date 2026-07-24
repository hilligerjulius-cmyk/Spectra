import { providerStatus } from "@/lib/env";
import type { ConnectorDefinition } from "./types";

/**
 * Registry aller Connectoren mit ehrlichem Implementierungsstatus.
 * Kein Connector täuscht Funktionalität vor: "planned" erscheint im UI
 * als "noch nicht implementiert", "credentials_required" nennt die fehlenden
 * Zugangsdaten.
 */
export const connectorRegistry: ConnectorDefinition[] = [
  {
    key: "demo-email",
    name: "Demo-Postfach",
    category: "email",
    description:
      "Vollständig funktionsfähiges E-Mail-Postfach innerhalb der Plattform: eingehende Nachrichten, Triage, Antwortentwürfe und Versand in die Outbox. Ideal zum Testen der Agenten ohne echtes Postfach.",
    status: "implemented",
    providesTools: ["email.read", "email.draft", "email.send", "email.label"],
  },
  {
    key: "demo-calendar",
    name: "Demo-Kalender",
    category: "calendar",
    description:
      "Plattform-interner Kalender mit Terminen, Teilnehmern und Zeitfenstern. Der Meeting-Preparation-Agent erstellt daraus quellenbasierte Briefings.",
    status: "implemented",
    providesTools: ["calendar.read", "calendar.write"],
  },
  {
    key: "webhook",
    name: "Eingehende Webhooks",
    category: "generic",
    description:
      "Signierter HTTPS-Endpunkt (HMAC-SHA256), über den Fremdsysteme Ereignisse an Ihre Agenten senden können.",
    status: "implemented",
    providesTools: [],
  },
  {
    key: "csv",
    name: "CSV-Import & Export",
    category: "generic",
    description:
      "Import von Deals, Kontakten und Zahlungsdaten per CSV sowie Export von Aufgaben, Läufen und Berichten.",
    status: "implemented",
    providesTools: ["deals.read"],
  },
  {
    key: "gmail",
    name: "Gmail",
    category: "email",
    description:
      "Echte Gmail-Anbindung über die Google-API mit minimalen OAuth-Scopes (lesen, entwerfen, senden).",
    status: "credentials_required",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    setupNote:
      "Google-OAuth-Client-Zugangsdaten in den Environment-Variablen hinterlegen, dann Postfach verbinden.",
    providesTools: ["email.read", "email.draft", "email.send", "email.label"],
  },
  {
    key: "google-calendar",
    name: "Google Calendar",
    category: "calendar",
    description:
      "Echte Google-Calendar-Anbindung: Termine lesen, freie Zeitfenster finden, Termine nach Freigabe anlegen.",
    status: "credentials_required",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    setupNote:
      "Google-OAuth-Client-Zugangsdaten hinterlegen, dann Kalender verbinden.",
    providesTools: ["calendar.read", "calendar.write"],
  },
  {
    key: "stripe",
    name: "Stripe",
    category: "accounting",
    description:
      "Abonnements, Zahlungen und Rechnungen über Stripe (Testmodus möglich).",
    status: "credentials_required",
    requiredEnv: ["STRIPE_SECRET_KEY"],
    setupNote: "Stripe-Testschlüssel hinterlegen, um echte Abrechnung zu aktivieren.",
    providesTools: [],
  },
  // Geplante Connectoren — Interface vorhanden, Implementierung offen
  ...(
    [
      ["outlook", "Microsoft Outlook", "email"],
      ["microsoft-calendar", "Microsoft Calendar", "calendar"],
      ["google-drive", "Google Drive", "files"],
      ["onedrive", "Microsoft OneDrive", "files"],
      ["dropbox", "Dropbox", "files"],
      ["slack", "Slack", "chat"],
      ["teams", "Microsoft Teams", "chat"],
      ["hubspot", "HubSpot", "crm"],
      ["salesforce", "Salesforce", "crm"],
      ["pipedrive", "Pipedrive", "crm"],
      ["notion", "Notion", "files"],
      ["sevdesk", "sevdesk", "accounting"],
      ["lexoffice", "lexoffice", "accounting"],
      ["datev", "DATEV", "accounting"],
    ] as const
  ).map(([key, name, category]) => ({
    key,
    name,
    category: category as ConnectorDefinition["category"],
    description: `${name}-Anbindung ist vorgesehen, aber noch nicht implementiert. Der Connector-Layer stellt die Schnittstelle bereit; die Umsetzung erfordert eine App-Registrierung beim Anbieter.`,
    status: "planned" as const,
    providesTools: [],
    setupNote:
      "Noch nicht implementiert — bis dahin können Sie Daten über CSV-Import oder Webhooks übergeben.",
  })),
];

export function getConnector(key: string): ConnectorDefinition | undefined {
  return connectorRegistry.find((c) => c.key === key);
}

/** Ist ein Connector aktuell einsatzbereit (Credentials vorhanden)? */
export function isConnectorAvailable(def: ConnectorDefinition): boolean {
  if (def.status === "implemented") return true;
  if (def.status === "planned") return false;
  if (def.key === "gmail" || def.key === "google-calendar") {
    return providerStatus.googleOAuth;
  }
  if (def.key === "stripe") return providerStatus.stripe;
  return false;
}
