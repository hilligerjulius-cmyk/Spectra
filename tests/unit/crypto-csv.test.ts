import { describe, expect, it } from "vitest";
import {
  computeWebhookSignature,
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  maskSecret,
  verifyWebhookSignature,
  WEBHOOK_TOLERANCE_SECONDS,
} from "@/server/integrations/crypto";
import {
  detectDelimiter,
  parseCsv,
  toCsv,
} from "@/server/integrations/csv";

describe("Verschlüsselung von Zugangsdaten", () => {
  it("verschlüsselt und entschlüsselt verlustfrei", () => {
    const secret = "sk_test_geheim_mit_ümläuten_und_€";
    const stored = encryptSecret(secret);
    expect(stored).not.toContain(secret);
    expect(stored.startsWith("v1:")).toBe(true);
    expect(decryptSecret(stored)).toBe(secret);
  });

  it("erzeugt für denselben Klartext unterschiedliche Chiffrate", () => {
    // Jede Verschlüsselung nutzt eine eigene IV — sonst wären gleiche
    // Geheimnisse an gleichen Chiffraten erkennbar.
    const a = encryptSecret("gleicher-wert");
    const b = encryptSecret("gleicher-wert");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(decryptSecret(b));
  });

  it("erkennt Manipulation am Chiffrat", () => {
    const stored = encryptSecret("unveränderlich");
    const parts = stored.split(":");
    const data = Buffer.from(parts[3]!, "base64");
    data[0] = data[0]! ^ 0xff; // ein Bit kippen
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      data.toString("base64"),
    ].join(":");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("weist unbekannte Formate ab, statt sie zu raten", () => {
    expect(() => decryptSecret("nur-klartext")).toThrow(/unbekannten Format/i);
    expect(() => decryptSecret("v2:a:b:c")).toThrow(/unbekannten Format/i);
  });

  it("maskiert Geheimnisse für die Anzeige", () => {
    const secret = generateWebhookSecret();
    const masked = maskSecret(secret);
    expect(masked).not.toBe(secret);
    expect(masked).toContain("…");
    expect(maskSecret("kurz")).toBe("••••••••");
  });
});

describe("Webhook-Signatur", () => {
  const secret = "whsec_testgeheimnis";
  const body = JSON.stringify({ event: "task.created", title: "Test" });
  const now = 1_800_000_000_000;
  const timestamp = String(Math.floor(now / 1000));

  it("akzeptiert eine korrekt gebildete Signatur", () => {
    const signature = computeWebhookSignature({ secret, timestamp, body });
    const result = verifyWebhookSignature({
      secret,
      timestamp,
      body,
      signature,
      now,
    });
    expect(result.valid).toBe(true);
  });

  it("lehnt eine veränderte Nutzlast ab", () => {
    const signature = computeWebhookSignature({ secret, timestamp, body });
    const result = verifyWebhookSignature({
      secret,
      timestamp,
      body: body.replace("Test", "Manipuliert"),
      signature,
      now,
    });
    expect(result.valid).toBe(false);
  });

  it("lehnt ein falsches Geheimnis ab", () => {
    const signature = computeWebhookSignature({
      secret: "whsec_falsch",
      timestamp,
      body,
    });
    const result = verifyWebhookSignature({
      secret,
      timestamp,
      body,
      signature,
      now,
    });
    expect(result.valid).toBe(false);
  });

  it("lehnt zu alte Aufrufe ab (Replay-Schutz)", () => {
    const oldTimestamp = String(
      Math.floor(now / 1000) - WEBHOOK_TOLERANCE_SECONDS - 1,
    );
    const signature = computeWebhookSignature({
      secret,
      timestamp: oldTimestamp,
      body,
    });
    const result = verifyWebhookSignature({
      secret,
      timestamp: oldTimestamp,
      body,
      signature,
      now,
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Abweichung/);
  });

  it("lehnt fehlende oder unsinnige Zeitstempel ab", () => {
    const signature = computeWebhookSignature({ secret, timestamp, body });
    expect(
      verifyWebhookSignature({
        secret,
        timestamp: "keine-zahl",
        body,
        signature,
        now,
      }).valid,
    ).toBe(false);
  });
});

describe("CSV", () => {
  it("erkennt das Trennzeichen deutscher Tabellenprogramme", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a,b,c\n1,2,3")).toBe(",");
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    // Ohne erkennbares Trennzeichen: Komma als Standard.
    expect(detectDelimiter("nur-eine-spalte")).toBe(",");
  });

  it("liest Felder mit Trennzeichen, Anführungszeichen und Umbrüchen", () => {
    const csv = [
      'titel;beschreibung;prioritaet',
      '"Angebot; dringend";"Zeile 1\nZeile 2";high',
      'Normal;"Er sagte ""ja""";normal',
    ].join("\n");
    const { headers, rows } = parseCsv(csv);
    expect(headers).toEqual(["titel", "beschreibung", "prioritaet"]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.titel).toBe("Angebot; dringend");
    expect(rows[0]!.beschreibung).toBe("Zeile 1\nZeile 2");
    expect(rows[1]!.beschreibung).toBe('Er sagte "ja"');
  });

  it("entfernt den BOM von Excel-Exporten", () => {
    const { headers } = parseCsv("﻿titel;wert\nA;1");
    expect(headers[0]).toBe("titel");
  });

  it("ignoriert leere Zeilen", () => {
    const { rows } = parseCsv("titel\nA\n\n\nB\n");
    expect(rows.map((r) => r.titel)).toEqual(["A", "B"]);
  });

  it("erzeugt Ausgaben, die sich unverändert wieder einlesen lassen", () => {
    const headers = ["titel", "notiz"];
    const rows = [
      { titel: 'Mit "Zitat"', notiz: "Semikolon; und\nUmbruch" },
      { titel: "Schlicht", notiz: null },
    ];
    const csv = toCsv(headers, rows);
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(headers);
    expect(parsed.rows[0]!.titel).toBe('Mit "Zitat"');
    expect(parsed.rows[0]!.notiz).toBe("Semikolon; und\nUmbruch");
    expect(parsed.rows[1]!.notiz).toBe("");
  });
});
