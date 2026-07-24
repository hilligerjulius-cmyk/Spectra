"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requirePermission, PermissionError } from "@/server/auth/guards";
import { withOrg } from "@/server/db/client";
import { knowledgeDocument, agentInstance } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { ingestDocument, searchKnowledge } from "./service";
import { startRun } from "@/server/agents/runtime/engine";

export interface KnowledgeActionResult {
  ok: boolean;
  message: string;
}

function failure(err: unknown): KnowledgeActionResult {
  if (err instanceof PermissionError) return { ok: false, message: err.message };
  console.error("Knowledge-Action fehlgeschlagen:", err);
  return {
    ok: false,
    message: err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
  };
}

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];

export async function uploadKnowledgeDocument(
  formData: FormData,
): Promise<KnowledgeActionResult> {
  try {
    const ctx = await requirePermission("knowledge", "upload");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, message: "Keine Datei übermittelt." };
    }
    if (file.size === 0) {
      return { ok: false, message: "Die Datei ist leer." };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return { ok: false, message: "Die Datei ist größer als 10 MB." };
    }
    const lower = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      return {
        ok: false,
        message: "Nicht unterstützter Dateityp. Erlaubt: PDF, DOCX, TXT, Markdown.",
      };
    }

    const accessScope = String(formData.get("accessScope") ?? "organization");
    const title = String(formData.get("title") ?? "").trim();
    const restrictedRoles = ["owner", "admin"];

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ingestDocument({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userLabel: ctx.session.user.name,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      title: title || undefined,
      accessScope: accessScope === "restricted" ? "restricted" : "organization",
      allowedRoles: accessScope === "restricted" ? restrictedRoles : [],
    });

    revalidatePath("/app/knowledge");
    return {
      ok: true,
      message: `Dokument verarbeitet: ${result.chunkCount} Abschnitte indexiert.`,
    };
  } catch (err) {
    return failure(err);
  }
}

export async function deleteKnowledgeDocument(
  documentId: string,
): Promise<KnowledgeActionResult> {
  try {
    const ctx = await requirePermission("knowledge", "manage");
    const deleted = await withOrg(ctx.organizationId, (tx) =>
      tx
        .delete(knowledgeDocument)
        .where(eq(knowledgeDocument.id, documentId))
        .returning({ title: knowledgeDocument.title }),
    );
    if (deleted.length === 0) {
      return { ok: false, message: "Dokument nicht gefunden." };
    }
    await recordAudit({
      organizationId: ctx.organizationId,
      actorType: "user",
      actorId: ctx.userId,
      actorLabel: ctx.session.user.name,
      action: "knowledge.document.deleted",
      targetType: "knowledge_document",
      targetId: documentId,
      summary: `Wissensdokument "${deleted[0]!.title}" gelöscht (inkl. aller Abschnitte).`,
    });
    revalidatePath("/app/knowledge");
    return { ok: true, message: "Dokument gelöscht." };
  } catch (err) {
    return failure(err);
  }
}

export interface KnowledgeAnswer {
  ok: boolean;
  message: string;
  answer?: string;
  sources?: { title: string; chunkId: string }[];
  confidence?: string;
}

/**
 * Wissensfrage stellen. Läuft über den Company-Memory-Agenten, sofern er
 * gebucht ist (revisionsfähiger Lauf); sonst direkt über die Suche mit
 * derselben Rechteprüfung.
 */
export async function askKnowledge(question: string): Promise<KnowledgeAnswer> {
  try {
    const ctx = await requirePermission("knowledge", "view");
    const parsed = z.string().trim().min(3).max(1000).safeParse(question);
    if (!parsed.success) {
      return { ok: false, message: "Bitte eine Frage mit mindestens 3 Zeichen eingeben." };
    }

    const [memoryAgent] = await withOrg(ctx.organizationId, (tx) =>
      tx
        .select()
        .from(agentInstance)
        .where(eq(agentInstance.definitionSlug, "company-memory")),
    );

    if (memoryAgent && memoryAgent.status !== "disabled") {
      const outcome = await startRun({
        organizationId: ctx.organizationId,
        instanceId: memoryAgent.id,
        capabilityKey: "qa-with-sources",
        goal: `Wissensfrage: ${parsed.data.slice(0, 120)}`,
        input: { question: parsed.data, requesterRole: ctx.role },
        trigger: { type: "manual", userId: ctx.userId },
        requestedByUserId: ctx.userId,
        sandbox: memoryAgent.status === "sandbox",
      });
      const [run] = await withOrg(ctx.organizationId, async (tx) => {
        const { agentRun } = await import("@/server/db/schema");
        return tx.select().from(agentRun).where(eq(agentRun.id, outcome.runId));
      });
      const output = run?.output as
        | {
            answer?: string;
            sources?: { title: string; chunkId: string }[];
            confidence?: string;
          }
        | null;
      revalidatePath("/app/activity");
      return {
        ok: true,
        message: outcome.summary ?? "Antwort erstellt.",
        answer: output?.answer,
        sources: output?.sources ?? [],
        confidence: output?.confidence,
      };
    }

    // Fallback ohne gebuchten Agenten: reine Suche mit Rechteprüfung
    const hits = await searchKnowledge({
      organizationId: ctx.organizationId,
      query: parsed.data,
      requesterRole: ctx.role,
      limit: 3,
    });
    if (hits.length === 0) {
      return {
        ok: true,
        message: "Kein Beleg gefunden.",
        answer:
          "Für diese Frage liegt in den für Sie freigegebenen Dokumenten kein Beleg vor.",
        sources: [],
        confidence: "nicht_belegt",
      };
    }
    return {
      ok: true,
      message: `${hits.length} Fundstelle(n).`,
      answer: hits[0]!.content.slice(0, 800),
      sources: hits.map((h) => ({ title: h.documentTitle, chunkId: h.chunkId })),
      confidence: "teilweise_belegt",
    };
  } catch (err) {
    const f = failure(err);
    return { ok: false, message: f.message };
  }
}
