import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import { knowledgeChunk, knowledgeDocument } from "@/server/db/schema";
import { getEmbeddingProvider } from "@/server/ai/embeddings";
import { recordAudit } from "@/server/audit";
import { roleHasPermission } from "@/server/auth/permissions";

/**
 * Wissenssystem: Extraktion → Chunking → Embedding → Hybrid-Suche.
 * Sicherheitsprinzipien:
 *  - Jede Abfrage prüft Mandant (RLS) UND Dokumentrechte (accessScope/Rollen).
 *  - Dokumentinhalte werden als Daten behandelt; bei der Übergabe an KI-Tasks
 *    werden sie in <daten>-Blöcken transportiert (Prompt-Injection-Härtung).
 */

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 150;

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  if (
    mimeType.startsWith("text/") ||
    filename.endsWith(".md") ||
    filename.endsWith(".txt")
  ) {
    return buffer.toString("utf-8");
  }
  if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    return result.text;
  }
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(
    `Dateityp wird nicht unterstützt (${mimeType}). Erlaubt: PDF, DOCX, TXT, Markdown.`,
  );
}

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length === 0) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);
    // An Absatz-/Satzgrenze schneiden, wenn möglich
    if (end < cleaned.length) {
      const paragraphBreak = cleaned.lastIndexOf("\n\n", end);
      const sentenceBreak = cleaned.lastIndexOf(". ", end);
      const cut = Math.max(paragraphBreak, sentenceBreak);
      if (cut > start + CHUNK_SIZE / 2) end = cut + 1;
    }
    chunks.push(cleaned.slice(start, end).trim());
    if (end >= cleaned.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks.filter((c) => c.length > 20);
}

export type DocumentOrigin = "upload" | "agent_knowledge" | "agent_document";

export interface UploadDocumentParams {
  organizationId: string;
  /** null, wenn ein Agent den Inhalt erzeugt hat (kein Mensch als Urheber). */
  userId: string | null;
  userLabel: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  title?: string;
  accessScope?: "organization" | "restricted";
  allowedRoles?: string[];
  /**
   * Herkunft. Muss gesetzt werden, wenn ein Agent schreibt — sonst wäre der
   * Inhalt später nicht von einem hochgeladenen Dokument zu unterscheiden.
   */
  origin?: DocumentOrigin;
  agentInstanceId?: string | null;
  runId?: string | null;
}

export async function ingestDocument(
  params: UploadDocumentParams,
): Promise<{ documentId: string; chunkCount: number }> {
  const provider = getEmbeddingProvider();
  const [doc] = await withOrg(params.organizationId, (tx) =>
    tx
      .insert(knowledgeDocument)
      .values({
        organizationId: params.organizationId,
        title: params.title?.trim() || params.filename,
        filename: params.filename,
        mimeType: params.mimeType,
        sizeBytes: params.buffer.length,
        status: "processing",
        accessScope: params.accessScope ?? "organization",
        allowedRoles: params.allowedRoles ?? [],
        uploadedByUserId: params.userId,
        embeddingProvider: provider.name,
        origin: params.origin ?? "upload",
        createdByAgentInstanceId: params.agentInstanceId ?? null,
        createdByRunId: params.runId ?? null,
      })
      .returning({ id: knowledgeDocument.id }),
  );
  const documentId = doc!.id;

  try {
    const text = await extractText(params.buffer, params.mimeType, params.filename);
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("Kein extrahierbarer Textinhalt gefunden.");
    }
    const embeddings = await provider.embed(chunks);
    await withOrg(params.organizationId, async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        await tx.insert(knowledgeChunk).values({
          organizationId: params.organizationId,
          documentId,
          index: i,
          content: chunks[i]!,
          embedding: embeddings[i]!,
        });
      }
      await tx
        .update(knowledgeDocument)
        .set({ status: "ready", chunkCount: chunks.length })
        .where(eq(knowledgeDocument.id, documentId));
    });
    const byAgent = (params.origin ?? "upload") !== "upload";
    await recordAudit({
      organizationId: params.organizationId,
      actorType: byAgent ? "agent" : "user",
      actorId: byAgent ? (params.agentInstanceId ?? null) : params.userId,
      actorLabel: params.userLabel,
      action: "knowledge.document.ingested",
      targetType: "knowledge_document",
      targetId: documentId,
      summary: `Dokument "${params.title ?? params.filename}" verarbeitet (${chunks.length} Chunks, Embeddings: ${provider.name}).`,
    });
    return { documentId, chunkCount: chunks.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await withOrg(params.organizationId, (tx) =>
      tx
        .update(knowledgeDocument)
        .set({ status: "failed", error: message })
        .where(eq(knowledgeDocument.id, documentId)),
    );
    throw err;
  }
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  /**
   * Herkunft des Belegs. Ein Agent, der eine Antwort belegt, muss unterscheiden
   * können, ob die Fundstelle aus einem hochgeladenen Dokument stammt oder von
   * einem anderen Agenten geschrieben wurde.
   */
  origin: DocumentOrigin;
}

/**
 * Hybrid-Suche (Vektor + Volltext) mit Rechteprüfung.
 * `requesterRole` steuert den Zugriff auf "restricted"-Dokumente; ohne Rolle
 * (z. B. reiner Systemlauf) sind nur "organization"-Dokumente sichtbar.
 */
/**
 * Baut aus einer Nutzerfrage eine ODER-verknüpfte tsquery.
 *
 * `websearch_to_tsquery` verknüpft Terme mit UND — ein einziges nicht
 * enthaltenes Wort setzt den Treffer auf null, was für Suche und RAG
 * unbrauchbar ist. Stattdessen werden die Terme mit `|` verknüpft, sodass
 * Dokumente mit Teiltreffern gefunden und über `ts_rank` sortiert werden.
 *
 * Sicherheit: Jeder Term wird auf Buchstaben und Ziffern reduziert, bevor er
 * in die Query eingesetzt wird — tsquery-Operatoren können nicht überleben.
 */
export function buildOrTsQuery(query: string): string | null {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((t) => t.length > 2);
  if (terms.length === 0) return null;
  return [...new Set(terms)].slice(0, 20).join(" | ");
}

export async function searchKnowledge(params: {
  organizationId: string;
  query: string;
  requesterRole: string | null;
  limit?: number;
}): Promise<SearchResult[]> {
  const limit = params.limit ?? 5;
  const provider = getEmbeddingProvider();
  const [queryEmbedding] = await provider.embed([params.query]);
  const vectorLiteral = `[${queryEmbedding!.join(",")}]`;
  // Leere tsquery ('') matcht nichts — die Vektorsuche trägt dann allein.
  const tsQuery = buildOrTsQuery(params.query) ?? "";

  const rows = await withOrg(params.organizationId, (tx) =>
    tx.execute(sql`
      WITH scored AS (
        SELECT
          c.id AS chunk_id,
          c.document_id,
          d.title AS document_title,
          d.origin AS origin,
          c.content,
          (1 - (c.embedding <=> ${vectorLiteral}::vector)) AS vector_score,
          ts_rank(
            to_tsvector('german', c.content),
            to_tsquery('german', ${tsQuery})
          ) AS text_score
        FROM knowledge_chunk c
        JOIN knowledge_document d ON d.id = c.document_id
        WHERE d.status = 'ready'
          AND (
            d.access_scope = 'organization'
            OR (
              ${params.requesterRole ?? ""} <> ''
              AND d.allowed_roles ? ${params.requesterRole ?? ""}
            )
          )
      )
      SELECT *,
        COALESCE(vector_score, 0) * 0.6
        + LEAST(COALESCE(text_score, 0) * 10, 1) * 0.4 AS hybrid_score
      FROM scored
      ORDER BY hybrid_score DESC
      LIMIT ${limit}
    `),
  );

  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    chunkId: String(r.chunk_id),
    documentId: String(r.document_id),
    documentTitle: String(r.document_title),
    content: String(r.content),
    score: Number(r.hybrid_score ?? 0),
    origin: String(r.origin ?? "upload") as DocumentOrigin,
  }));
}

/** Prüft, ob eine Rolle ein Dokument sehen darf (für Detail-Zugriffe). */
export function canAccessDocument(
  doc: { accessScope: string; allowedRoles: string[] },
  role: string | null,
): boolean {
  if (doc.accessScope === "organization") {
    return role ? roleHasPermission(role, "knowledge", "view") : true;
  }
  return Boolean(role && doc.allowedRoles.includes(role));
}

export async function listDocuments(organizationId: string) {
  return withOrg(organizationId, (tx) =>
    tx
      .select()
      .from(knowledgeDocument)
      .orderBy(desc(knowledgeDocument.createdAt))
      .limit(100),
  );
}
