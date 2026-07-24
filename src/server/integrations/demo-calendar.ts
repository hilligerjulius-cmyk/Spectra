import { and, asc, eq, gte, lte } from "drizzle-orm";
import { withOrg } from "@/server/db/client";
import { calendarEvent, integration } from "@/server/db/schema";
import type { CalendarConnector, CalendarEventInput } from "./types";

/**
 * Demo-Kalender-Connector: plattforminterner Kalender mit echten Lese- und
 * Schreiboperationen. Grundlage für Meeting-Briefings und Terminvorschläge,
 * ohne dass ein externer Kalender verbunden sein muss.
 */
export class DemoCalendarConnector implements CalendarConnector {
  readonly key = "demo-calendar";

  async listUpcoming(organizationId: string, withinHours = 72) {
    const now = new Date();
    const until = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
    const rows = await withOrg(organizationId, (tx) =>
      tx
        .select()
        .from(calendarEvent)
        .where(
          and(
            gte(calendarEvent.startsAt, now),
            lte(calendarEvent.startsAt, until),
          ),
        )
        .orderBy(asc(calendarEvent.startsAt))
        .limit(25),
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      location: r.location,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      attendees: r.attendees,
    }));
  }

  async create(
    organizationId: string,
    event: CalendarEventInput,
  ): Promise<{ id: string }> {
    const [integrationRow] = await withOrg(organizationId, (tx) =>
      tx
        .select({ id: integration.id })
        .from(integration)
        .where(eq(integration.connectorKey, this.key)),
    );
    // Doppelbuchungs-Schutz: überlappende Termine im gleichen Zeitfenster
    const overlapping = await withOrg(organizationId, (tx) =>
      tx
        .select({ id: calendarEvent.id, title: calendarEvent.title })
        .from(calendarEvent)
        .where(
          and(
            lte(calendarEvent.startsAt, event.endsAt),
            gte(calendarEvent.endsAt, event.startsAt),
          ),
        )
        .limit(1),
    );
    if (overlapping.length > 0) {
      throw new Error(
        `Doppelbuchung verhindert: Es existiert bereits der Termin "${overlapping[0]!.title}" in diesem Zeitfenster.`,
      );
    }
    const [row] = await withOrg(organizationId, (tx) =>
      tx
        .insert(calendarEvent)
        .values({
          organizationId,
          integrationId: integrationRow?.id ?? null,
          title: event.title,
          description: event.description ?? null,
          location: event.location ?? null,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          attendees: event.attendees ?? [],
          demo: true,
        })
        .returning({ id: calendarEvent.id }),
    );
    return { id: row!.id };
  }
}

export const demoCalendarConnector = new DemoCalendarConnector();
