import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";
import { agentInstance } from "./agents";

/** Aufgaben — von Menschen oder Agenten erstellt, immer mandantenbezogen. */
export const task = pgTable(
  "task",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** open | in_progress | waiting | done | cancelled */
    status: text("status").notNull().default("open"),
    /** low | normal | high | urgent */
    priority: text("priority").notNull().default("normal"),
    assigneeUserId: text("assignee_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Agent, der die Aufgabe erstellt hat bzw. betreut. */
    agentInstanceId: text("agent_instance_id").references(
      () => agentInstance.id,
      { onDelete: "set null" },
    ),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** Herkunft, z. B. { type: "email", ref: "<message-id>" } — für Nachvollziehbarkeit. */
    source: jsonb("source").$type<Record<string, unknown>>(),
    /** user | agent | system */
    createdByType: text("created_by_type").notNull().default("user"),
    createdById: text("created_by_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("task_org_status_idx").on(t.organizationId, t.status),
    index("task_org_due_idx").on(t.organizationId, t.dueAt),
  ],
);

/** Ein Agentenlauf — revisionsfähige Aufzeichnung jeder Agentenausführung. */
export const agentRun = pgTable(
  "agent_run",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    agentInstanceId: text("agent_instance_id")
      .notNull()
      .references(() => agentInstance.id, { onDelete: "cascade" }),
    definitionSlug: text("definition_slug").notNull(),
    capabilityKey: text("capability_key").notNull(),
    /** { type: "manual" | "schedule" | "event" | "delegation" | "sandbox_test", detail?: … } */
    trigger: jsonb("trigger").$type<Record<string, unknown>>().notNull(),
    goal: text("goal").notNull(),
    /** queued | running | waiting_approval | completed | failed | cancelled */
    status: text("status").notNull().default("queued"),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    /** Kurze, sichere Ergebnis-Zusammenfassung für die Timeline. */
    summary: text("summary"),
    error: text("error"),
    model: text("model"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    /** Kosten in Zehntel-Cent (Millicent wäre übertrieben, Cent zu grob). */
    costDeciCents: integer("cost_deci_cents").notNull().default(0),
    stepCount: integer("step_count").notNull().default(0),
    maxSteps: integer("max_steps").notNull().default(20),
    durationMs: integer("duration_ms"),
    sandbox: boolean("sandbox").notNull().default(false),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Verhindert doppelte Ausführung desselben Auslösers. */
    idempotencyKey: text("idempotency_key"),
    retryCount: integer("retry_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("agent_run_org_created_idx").on(t.organizationId, t.createdAt),
    index("agent_run_instance_idx").on(t.agentInstanceId, t.createdAt),
    index("agent_run_status_idx").on(t.organizationId, t.status),
    uniqueIndex("agent_run_idempotency_uidx").on(
      t.organizationId,
      t.idempotencyKey,
    ),
  ],
);

/** Einzelschritte eines Laufs (Timeline: Beobachtung, Tool-Aufruf, Entwurf, …). */
export const agentStep = pgTable(
  "agent_step",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => agentRun.id, { onDelete: "cascade" }),
    index: integer("index").notNull(),
    /** plan | retrieve | reason | draft | validate | request_approval | execute | verify | report */
    phase: text("phase").notNull(),
    title: text("title").notNull(),
    /**
     * Sichere, kompakte Details (keine internen Gedankengänge):
     * { tool?, inputSummary?, outputSummary?, sources?: [{title, ref}] }
     */
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    /** ok | error | blocked */
    status: text("status").notNull().default("ok"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    costDeciCents: integer("cost_deci_cents").notNull().default(0),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_step_run_idx").on(t.runId, t.index)],
);

/** Freigabeanfrage: vollständig vorbereitete Aktion, wartet auf Entscheidung. */
export const approvalRequest = pgTable(
  "approval_request",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => agentRun.id, {
      onDelete: "set null",
    }),
    agentInstanceId: text("agent_instance_id")
      .notNull()
      .references(() => agentInstance.id, { onDelete: "cascade" }),
    capabilityKey: text("capability_key").notNull(),
    /** Aktionstyp, z. B. "task.create", "email.send" — für Sammelfreigaben. */
    actionType: text("action_type").notNull(),
    title: text("title").notNull(),
    /** Begründung des Agenten (sicher formuliert, keine internen Gedanken). */
    reasoning: text("reasoning").notNull(),
    /** Vorgeschlagene Aktion (strukturiert, wird bei Freigabe ausgeführt). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** Betroffene Daten / Quellen zur Anzeige. */
    affectedData: jsonb("affected_data").$type<Record<string, unknown>>(),
    /** low | medium | high */
    riskLevel: text("risk_level").notNull(),
    /** Geschätzte Kosten der Ausführung in Zehntel-Cent. */
    estimatedCostDeciCents: integer("estimated_cost_deci_cents"),
    /** pending | approved | rejected | expired | cancelled */
    status: text("status").notNull().default("pending"),
    decidedByUserId: text("decided_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    /** Vom Menschen bearbeitete Fassung des Payloads (falls "Bearbeiten"). */
    editedPayload: jsonb("edited_payload").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("approval_org_status_idx").on(t.organizationId, t.status),
    index("approval_run_idx").on(t.runId),
  ],
);

/** In-App-Benachrichtigungen. */
export const notification = pgTable(
  "notification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** approval_required | agent_failed | integration_disconnected | cost_limit |
     *  risk_detected | task_overdue | agent_paused | workflow_completed | info */
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notification_org_user_idx").on(t.organizationId, t.userId, t.createdAt)],
);
