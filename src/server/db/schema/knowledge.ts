import { sql } from "drizzle-orm";
import {
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/** pgvector-Spaltentyp (1024 Dimensionen — kompatibel mit Voyage und lokalem Fallback). */
const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(",")
      .map((v) => Number.parseFloat(v));
  },
});

/** Wissensdokumente (Upload → Extraktion → Chunking → Embedding). */
export const knowledgeDocument = pgTable(
  "knowledge_document",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    /** processing | ready | failed | archived */
    status: text("status").notNull().default("processing"),
    /**
     * Zugriffsmodell: "organization" = alle Rollen mit knowledge.view;
     * "restricted" = nur Rollen in allowedRoles.
     */
    accessScope: text("access_scope").notNull().default("organization"),
    allowedRoles: jsonb("allowed_roles").$type<string[]>().notNull().default([]),
    uploadedByUserId: text("uploaded_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    chunkCount: integer("chunk_count").notNull().default(0),
    embeddingProvider: text("embedding_provider").notNull().default("local"),
    error: text("error"),
    demo: text("demo"),
    /**
     * Herkunft des Inhalts. Entscheidend für Vertrauen: ein von einem Agenten
     * geschriebener Text darf in der Suche nicht wie ein hochgeladener Vertrag
     * aussehen. `agent_knowledge` = in die Wissensbasis geschrieben,
     * `agent_document` = erzeugtes Dokument (Entwurf).
     */
    origin: text("origin").notNull().default("upload"),
    /** Welcher Agent den Inhalt erzeugt hat — null bei Upload durch Menschen. */
    createdByAgentInstanceId: text("created_by_agent_instance_id"),
    /** Lauf, in dem der Inhalt entstand — macht die Erzeugung nachvollziehbar. */
    createdByRunId: text("created_by_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("knowledge_doc_org_idx").on(t.organizationId, t.status)],
);

/** Text-Chunks mit Embedding (Vektor) und Volltext (tsvector via Migration). */
export const knowledgeChunk = pgTable(
  "knowledge_chunk",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => knowledgeDocument.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    content: text("content").notNull(),
    embedding: vector1024("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("knowledge_chunk_doc_idx").on(t.documentId, t.index),
    index("knowledge_chunk_org_idx").on(t.organizationId),
    // Volltextindex (deutsch) — generierte tsvector-Spalte kommt per Custom-Migration
    index("knowledge_chunk_fts_idx").using(
      "gin",
      sql`to_tsvector('german', ${t.content})`,
    ),
  ],
);
