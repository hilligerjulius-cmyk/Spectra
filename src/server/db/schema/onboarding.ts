import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Fortschritt des Einrichtungsassistenten je Organisation.
 * Der Zustand liegt serverseitig, damit der Assistent geräteübergreifend
 * fortgesetzt werden kann und Aktivierungen nachvollziehbar bleiben.
 */
export const onboardingState = pgTable(
  "onboarding_state",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" })
      .unique(),
    /** 1-basierter Index des zuletzt erreichten Schritts. */
    currentStep: integer("current_step").notNull().default(1),
    /** Schlüssel der abgeschlossenen Schritte. */
    completedSteps: jsonb("completed_steps")
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Antworten aus den Profil-/Zielschritten (Konfigurator-Format). */
    answers: jsonb("answers")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    /** Zuletzt vorgeschlagene bzw. gewählte Agenten-Slugs. */
    selectedAgents: jsonb("selected_agents")
      .$type<string[]>()
      .notNull()
      .default([]),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    startedByUserId: text("started_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("onboarding_state_org_uidx").on(t.organizationId)],
);
