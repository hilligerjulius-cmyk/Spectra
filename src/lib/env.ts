import { z } from "zod";

/**
 * Serverseitige Environment-Validierung.
 * Optionale Keys (Anthropic, Stripe, Voyage, SMTP, Google OAuth) schalten die
 * jeweiligen echten Provider frei; ohne sie läuft die Plattform vollständig
 * im Demo-/Sandbox-Modus (Scripted-Provider, Mock-Billing, Outbox-Mail).
 * Niemals im Client importieren.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // App
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Datenbank: App-Rolle (RLS-unterworfen) und Owner-Rolle (Migrationen/Jobs)
  DATABASE_URL: z
    .string()
    .min(1)
    .default(
      "postgres://workforce_app:workforce_app_dev@localhost:5432/workforce_dev",
    ),
  DATABASE_ADMIN_URL: z
    .string()
    .min(1)
    .default(
      "postgres://workforce_owner:workforce_owner_dev@localhost:5432/workforce_dev",
    ),

  // Auth & Verschlüsselung
  AUTH_SECRET: z.string().min(16).default("dev-only-secret-change-me-please"),
  // 32-Byte-Hex-Key für AES-256-GCM-Verschlüsselung von Integration-Credentials
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, "64 Hex-Zeichen (32 Bytes) erforderlich")
    .default(
      "94a1c9f2b7d34e58a6c0f1e2d3b4a5968778695a4b3c2d1e0f9e8d7c6b5a4a39",
    ),

  // KI-Provider (optional → ScriptedProvider als Fallback)
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_DEFAULT_MODEL: z.string().default("claude-sonnet-5"),
  // Embeddings (optional → LocalEmbeddingProvider als Fallback)
  VOYAGE_API_KEY: z.string().optional(),

  // Billing (optional → MockBillingProvider)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // E-Mail-Versand (optional → Outbox in DB)
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("WORKFORCE OS <noreply@localhost>"),

  // Google OAuth für Gmail/Calendar-Adapter (optional → als "Zugangsdaten erforderlich" markiert)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Demo-Modus-Seeds erlauben
  ALLOW_DEMO_SEED: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Ungültige Environment-Konfiguration:\n${issues}`);
  }
  // Beim `next build` ist NODE_ENV immer "production"; die strikte Prüfung
  // greift daher erst zur Laufzeit des Produktionsservers.
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (
    !isBuildPhase &&
    parsed.data.NODE_ENV === "production" &&
    parsed.data.AUTH_SECRET === "dev-only-secret-change-me-please"
  ) {
    throw new Error("AUTH_SECRET muss in Produktion gesetzt werden.");
  }
  return parsed.data;
}

export const env = loadEnv();

/** Welche echten Provider sind konfiguriert? (für UI-Kennzeichnung) */
export const providerStatus = {
  anthropic: Boolean(env.ANTHROPIC_API_KEY),
  voyage: Boolean(env.VOYAGE_API_KEY),
  stripe: Boolean(env.STRIPE_SECRET_KEY),
  smtp: Boolean(env.SMTP_URL),
  googleOAuth: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
} as const;
