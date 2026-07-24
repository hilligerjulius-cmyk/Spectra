/**
 * Auswahloptionen der Bedarfsfragen. Die Schlüssel entsprechen exakt den
 * Regeln in `logic.ts` — Konfigurator (Website) und Einrichtungsassistent
 * (App) verwenden dieselbe Quelle, damit Empfehlungen konsistent bleiben.
 */

export const groessenOptions = ["1-4", "5-25", "26-100", "101-250"] as const;

export const softwareOptions = [
  "Gmail",
  "Outlook",
  "Google Calendar",
  "Microsoft Calendar",
  "HubSpot",
  "Salesforce",
  "Pipedrive",
  "Slack",
  "Microsoft Teams",
  "Notion",
  "Google Drive",
  "OneDrive",
  "Dropbox",
  "Stripe",
  "sevdesk",
  "lexoffice",
  "DATEV",
] as const;

export const zeitfresserOptions = [
  { key: "email", label: "E-Mail-Flut & Posteingang" },
  { key: "termine", label: "Terminkoordination" },
  { key: "followups", label: "Follow-ups & Nachfassen" },
  { key: "angebote", label: "Angebote erstellen" },
  { key: "rechnungen", label: "Rechnungen & Belege" },
  { key: "support", label: "Support-Anfragen" },
  { key: "wissen", label: "Wissen suchen & dokumentieren" },
  { key: "fristen", label: "Fristen & wiederkehrende Pflichten" },
  { key: "projekte", label: "Projektstatus einsammeln" },
  { key: "hr", label: "Personaladministration" },
];

export const umsatzOptions = [
  { key: "liegengebliebene-leads", label: "Leads werden zu langsam bearbeitet" },
  { key: "langsame-angebote", label: "Angebote gehen zu spät raus" },
  { key: "keine-followups", label: "Offene Angebote werden nicht nachgefasst" },
  { key: "churn", label: "Bestandskunden wandern ab" },
  { key: "keine-leads", label: "Zu wenig qualifizierte Zielkunden" },
];

export const departmentOptions = [
  { key: "sales", label: "Sales" },
  { key: "office", label: "Office" },
  { key: "finance", label: "Finance Operations" },
  { key: "hr", label: "HR Operations" },
  { key: "customer-service", label: "Customer Service" },
  { key: "operations", label: "Operations" },
  { key: "knowledge", label: "Knowledge" },
];

export const automatisierungOptions = [
  { key: "beobachten", label: "Nur beobachten und melden" },
  { key: "entwurf", label: "Entwürfe erstellen, ich entscheide" },
  { key: "freigabe", label: "Vorbereiten, ich gebe frei" },
  { key: "autonom", label: "Risikoarmes selbstständig erledigen" },
];

export const vorgaengeOptions = [
  "<100",
  "100-500",
  "500-2000",
  ">2000",
] as const;
