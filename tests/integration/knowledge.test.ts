import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Wissenssystem: Chunking, Hybrid-Suche und Rechteprüfung.
 *
 * Regressionsschutz für zwei konkrete Fehler, die in der Entwicklung auftraten:
 *  1. `websearch_to_tsquery` verknüpft Terme mit UND — eine Frage mit einem
 *     nicht enthaltenen Wort lieferte dadurch gar keinen Volltext-Treffer.
 *  2. Das lokale Hash-Embedding kannte keine Wortformen, sodass
 *     „Kündigungsfrist" und „Kündigungsfristen" orthogonal waren.
 */

const orgId = `kn-org-${Date.now()}`;
const userId = `kn-user-${Date.now()}`;

describe("Wissenssystem", () => {
  beforeAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.insert(organization).values({
      id: orgId,
      name: "Knowledge Org",
      slug: orgId,
      createdAt: new Date(),
    });
    await adminDb.insert(user).values({
      id: userId,
      name: "Knowledge Tester",
      email: `${userId}@example.com`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { ingestDocument } = await import("@/server/knowledge/service");
    await ingestDocument({
      organizationId: orgId,
      userId,
      userLabel: "Knowledge Tester",
      filename: "vertrag.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Servicevertrag\n\n## Kündigungsfristen\nVerträge können mit einer Frist von drei Monaten zum Jahresende gekündigt werden.\n\n## Wartungspauschale\nDie monatliche Wartungspauschale beträgt zwölf Prozent des Lizenzwertes.",
        "utf-8",
      ),
      title: "Servicevertrag",
    });
    await ingestDocument({
      organizationId: orgId,
      userId,
      userLabel: "Knowledge Tester",
      filename: "reise.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "# Reisekostenrichtlinie\n\n## Übernachtung\nErstattet werden Übernachtungskosten bis 140 Euro pro Nacht innerhalb Deutschlands.\n\n## Verkehrsmittel\nBahnfahrten werden in der zweiten Klasse erstattet.",
        "utf-8",
      ),
      title: "Reisekostenrichtlinie",
    });
  });

  afterAll(async () => {
    const { adminDb } = await import("@/server/db/client");
    const { organization, user } = await import("@/server/db/schema");
    await adminDb.delete(organization).where(eq(organization.id, orgId));
    await adminDb.delete(user).where(eq(user.id, userId));
  });

  it("Chunking zerlegt Text und behält Inhalte", async () => {
    const { chunkText } = await import("@/server/knowledge/service");
    const long = "Ein Satz mit ausreichend Inhalt. ".repeat(200);
    const chunks = chunkText(long);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length > 20)).toBe(true);
    expect(chunkText("")).toEqual([]);
  });

  it("ODER-tsquery: einzelne nicht enthaltene Wörter verhindern keinen Treffer", async () => {
    const { buildOrTsQuery } = await import("@/server/knowledge/service");
    expect(buildOrTsQuery("Kündigungsfrist Kunden")).toBe(
      "kündigungsfrist | kunden",
    );
    // tsquery-Operatoren werden entfernt (Injection-Schutz)
    expect(buildOrTsQuery("foo & bar | baz:*")).toBe("foo | bar | baz");
    expect(buildOrTsQuery("ab cd")).toBeNull();
  });

  it("findet das richtige Dokument trotz abweichender Wortform", async () => {
    const { searchKnowledge } = await import("@/server/knowledge/service");
    // Dokument enthält "Kündigungsfristen" (Plural), Frage nutzt Singular
    const hits = await searchKnowledge({
      organizationId: orgId,
      query: "Welche Kündigungsfrist gilt für Kunden?",
      requesterRole: "owner",
      limit: 2,
    });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.documentTitle).toBe("Servicevertrag");
    expect(hits[0]!.score).toBeGreaterThan(0);
    // Deutlicher Abstand zum unpassenden Dokument
    if (hits.length > 1) {
      expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score * 1.5);
    }
  });

  it("ordnet themenfremde Fragen dem passenden Dokument zu", async () => {
    const { searchKnowledge } = await import("@/server/knowledge/service");
    const hits = await searchKnowledge({
      organizationId: orgId,
      query: "Was wird bei Übernachtungen erstattet?",
      requesterRole: "owner",
      limit: 2,
    });
    expect(hits[0]!.documentTitle).toBe("Reisekostenrichtlinie");
  });

  it("nicht unterstützte Dateitypen werden abgelehnt", async () => {
    const { extractText } = await import("@/server/knowledge/service");
    await expect(
      extractText(Buffer.from("x"), "image/png", "bild.png"),
    ).rejects.toThrow(/nicht unterstützt/i);
  });

  it("leere Dokumente werden als fehlgeschlagen markiert statt still zu scheitern", async () => {
    const { ingestDocument } = await import("@/server/knowledge/service");
    await expect(
      ingestDocument({
        organizationId: orgId,
        userId,
        userLabel: "Knowledge Tester",
        filename: "leer.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("   ", "utf-8"),
        title: "Leeres Dokument",
      }),
    ).rejects.toThrow(/kein extrahierbarer Textinhalt/i);

    const { withOrg } = await import("@/server/db/client");
    const { knowledgeDocument } = await import("@/server/db/schema");
    const docs = await withOrg(orgId, (tx) =>
      tx
        .select()
        .from(knowledgeDocument)
        .where(eq(knowledgeDocument.title, "Leeres Dokument")),
    );
    expect(docs[0]!.status).toBe("failed");
    expect(docs[0]!.error).toBeTruthy();
  });
});
