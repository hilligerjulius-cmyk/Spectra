import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
  createHmac,
} from "node:crypto";
import { env } from "@/lib/env";

/**
 * Verschlüsselung von Integrations-Zugangsdaten (AES-256-GCM).
 *
 * Der Schlüssel kommt ausschließlich aus der Umgebung
 * (CREDENTIAL_ENCRYPTION_KEY) und wird nie in der Datenbank abgelegt. Jeder
 * Datensatz erhält eine eigene Zufalls-IV; das Authentifizierungs-Tag wird
 * mitgespeichert, sodass Manipulation beim Entschlüsseln auffällt.
 *
 * Gespeichertes Format: v1:<iv-base64>:<tag-base64>:<ciphertext-base64>
 * Das Präfix erlaubt einen späteren Schlüssel- oder Verfahrenswechsel, ohne
 * Altbestände falsch zu interpretieren.
 */

const VERSION = "v1";
const IV_BYTES = 12; // GCM-Standard
const KEY = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "hex");

if (KEY.length !== 32) {
  throw new Error(
    "CREDENTIAL_ENCRYPTION_KEY muss 32 Bytes (64 Hex-Zeichen) lang sein.",
  );
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error(
      "Zugangsdaten liegen in einem unbekannten Format vor. Bitte neu hinterlegen.",
    );
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivB64!, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
  // Schlägt fehl, wenn Chiffrat oder Tag verändert wurden.
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64!, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Erzeugt ein Webhook-Signaturgeheimnis. */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

/**
 * Berechnet die erwartete Signatur einer Webhook-Nutzlast.
 * Zeitstempel geht in die Signatur ein, damit ein abgefangener Aufruf nicht
 * beliebig lange wiederverwendet werden kann.
 */
export function computeWebhookSignature(params: {
  secret: string;
  timestamp: string;
  body: string;
}): string {
  return createHmac("sha256", params.secret)
    .update(`${params.timestamp}.${params.body}`)
    .digest("hex");
}

export interface SignatureCheck {
  valid: boolean;
  reason?: string;
}

/** Maximale Abweichung des Zeitstempels (Replay-Schutz). */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

/**
 * Prüft eine Webhook-Signatur in konstanter Zeit und lehnt zu alte oder zu
 * weit in der Zukunft liegende Zeitstempel ab.
 */
export function verifyWebhookSignature(params: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  now?: number;
}): SignatureCheck {
  const ts = Number.parseInt(params.timestamp, 10);
  if (!Number.isFinite(ts)) {
    return { valid: false, reason: "Zeitstempel fehlt oder ist ungültig." };
  }
  const nowSeconds = Math.floor((params.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - ts) > WEBHOOK_TOLERANCE_SECONDS) {
    return {
      valid: false,
      reason: `Zeitstempel liegt außerhalb der zulässigen Abweichung von ${WEBHOOK_TOLERANCE_SECONDS} Sekunden.`,
    };
  }

  const expected = computeWebhookSignature({
    secret: params.secret,
    timestamp: params.timestamp,
    body: params.body,
  });
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(params.signature.trim(), "utf8");
  if (expectedBuf.length !== providedBuf.length) {
    return { valid: false, reason: "Signatur stimmt nicht überein." };
  }
  // timingSafeEqual verhindert, dass die Laufzeit Rückschlüsse zulässt.
  return timingSafeEqual(expectedBuf, providedBuf)
    ? { valid: true }
    : { valid: false, reason: "Signatur stimmt nicht überein." };
}

/** Zeigt ein Geheimnis gekürzt an — vollständige Werte gehören nie ins UI. */
export function maskSecret(secret: string): string {
  if (secret.length <= 12) return "••••••••";
  return `${secret.slice(0, 8)}…${secret.slice(-4)}`;
}
