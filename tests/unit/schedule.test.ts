import { describe, expect, it } from "vitest";
import {
  currentSlot,
  describeSchedule,
  isDue,
  isValidTimeZone,
  localParts,
  type ScheduleSpec,
} from "@/server/jobs/schedule";

/**
 * Fälligkeitsberechnung der Zeitpläne.
 *
 * Der Schwerpunkt liegt auf den Fällen, die im Betrieb wehtun: Sommerzeitwechsel,
 * Neustart des Workers, mehrfache Prüfung innerhalb derselben Minute und
 * Zeitzonen, die nicht der Serverzeit entsprechen.
 */

function spec(overrides: Partial<ScheduleSpec> = {}): ScheduleSpec {
  return {
    frequency: "daily",
    hour: 7,
    minute: 0,
    weekday: null,
    timezone: "Europe/Berlin",
    ...overrides,
  };
}

describe("localParts", () => {
  it("rechnet UTC korrekt in die Zielzeitzone um", () => {
    // 2026-07-27 05:30 UTC = 07:30 in Berlin (Sommerzeit, UTC+2)
    const p = localParts(new Date("2026-07-27T05:30:00Z"), "Europe/Berlin");
    expect(p).toEqual({
      year: 2026,
      month: 7,
      day: 27,
      hour: 7,
      minute: 30,
      weekday: 1, // Montag
    });
  });

  it("behandelt Mitternacht als Stunde 0, nicht als 24", () => {
    const p = localParts(new Date("2026-07-26T22:15:00Z"), "Europe/Berlin");
    expect(p.hour).toBe(0);
    expect(p.day).toBe(27);
  });

  it("berücksichtigt die Winterzeit", () => {
    // Im Januar gilt UTC+1.
    const p = localParts(new Date("2026-01-15T06:30:00Z"), "Europe/Berlin");
    expect(p.hour).toBe(7);
  });

  it("arbeitet auch mit Zeitzonen jenseits von Europa", () => {
    const p = localParts(new Date("2026-07-27T05:30:00Z"), "America/New_York");
    expect(p.hour).toBe(1);
    expect(p.day).toBe(27);
  });
});

describe("currentSlot", () => {
  it("liefert keinen Slot, bevor die Uhrzeit erreicht ist", () => {
    // 06:30 Berlin, geplant 07:00
    expect(currentSlot(spec(), new Date("2026-07-27T04:30:00Z"))).toBeNull();
  });

  it("liefert den Tagesslot, sobald die Uhrzeit erreicht ist", () => {
    expect(currentSlot(spec(), new Date("2026-07-27T05:00:00Z"))).toBe(
      "2026-07-27",
    );
  });

  it("behält denselben Slot über den ganzen restlichen Tag", () => {
    const morgens = currentSlot(spec(), new Date("2026-07-27T05:00:00Z"));
    const abends = currentSlot(spec(), new Date("2026-07-27T20:00:00Z"));
    expect(morgens).toBe(abends);
  });

  it("überspringt bei werktäglichen Plänen das Wochenende", () => {
    const werktags = spec({ frequency: "weekday" });
    // 2026-08-01 ist ein Samstag, 2026-08-03 ein Montag.
    expect(currentSlot(werktags, new Date("2026-08-01T09:00:00Z"))).toBeNull();
    expect(currentSlot(werktags, new Date("2026-08-02T09:00:00Z"))).toBeNull();
    expect(currentSlot(werktags, new Date("2026-08-03T09:00:00Z"))).toBe(
      "2026-08-03",
    );
  });

  it("läuft bei wöchentlichen Plänen nur am gewählten Wochentag", () => {
    // Mittwoch = 3
    const woechentlich = spec({ frequency: "weekly", weekday: 3 });
    expect(currentSlot(woechentlich, new Date("2026-07-27T09:00:00Z"))).toBeNull();
    expect(currentSlot(woechentlich, new Date("2026-07-29T09:00:00Z"))).toBe(
      "2026-07-29",
    );
  });

  it("bildet bei stündlichen Plänen je Stunde einen eigenen Slot", () => {
    const stuendlich = spec({ frequency: "hourly", minute: 15 });
    expect(currentSlot(stuendlich, new Date("2026-07-27T05:10:00Z"))).toBeNull();
    expect(currentSlot(stuendlich, new Date("2026-07-27T05:15:00Z"))).toBe(
      "2026-07-27T07",
    );
    expect(currentSlot(stuendlich, new Date("2026-07-27T06:20:00Z"))).toBe(
      "2026-07-27T08",
    );
  });
});

describe("isDue", () => {
  it("ist fällig, wenn der Slot noch nie gelaufen ist", () => {
    const result = isDue(spec(), new Date("2026-07-27T05:00:00Z"), null);
    expect(result).toEqual({ due: true, slot: "2026-07-27" });
  });

  it("läuft denselben Slot nicht zweimal", () => {
    const now = new Date("2026-07-27T05:00:00Z");
    const first = isDue(spec(), now, null);
    expect(first.due).toBe(true);
    // Zweite Prüfung in derselben Minute — der Worker fragt jede Minute.
    expect(isDue(spec(), now, first.slot).due).toBe(false);
    // Und auch Stunden später nicht erneut.
    expect(isDue(spec(), new Date("2026-07-27T18:00:00Z"), first.slot).due).toBe(
      false,
    );
  });

  it("ist am Folgetag wieder fällig", () => {
    expect(
      isDue(spec(), new Date("2026-07-28T05:00:00Z"), "2026-07-27").due,
    ).toBe(true);
  });

  it("holt einen verpassten Lauf nach einem Worker-Ausfall auf", () => {
    // Der Worker war den ganzen Morgen aus und startet um 14:00 Ortszeit.
    const result = isDue(spec(), new Date("2026-07-27T12:00:00Z"), "2026-07-26");
    expect(result.due).toBe(true);
    expect(result.slot).toBe("2026-07-27");
  });

  it("holt aber nur den aktuellen Slot nach, nicht jeden verpassten", () => {
    // Drei Tage Ausfall führen zu genau einem Lauf, nicht zu drei.
    const result = isDue(spec(), new Date("2026-07-27T05:00:00Z"), "2026-07-24");
    expect(result.slot).toBe("2026-07-27");
  });

  /*
   * Sommerzeit: Am 25.10.2026 wird in Europa die Uhr um 03:00 auf 02:00
   * zurückgestellt. Ein Zeitplan um 02:30 hat an diesem Tag zwei Ortszeit-
   * Fenster. Das Slot-Verfahren erlaubt trotzdem nur einen Lauf.
   */
  it("führt beim Rückstellen der Uhr keinen doppelten Lauf aus", () => {
    const nachts = spec({ hour: 2, minute: 30 });
    // Erster Durchlauf von 02:30 Ortszeit (= 00:30 UTC, noch Sommerzeit).
    const ersteRunde = isDue(nachts, new Date("2026-10-25T00:30:00Z"), null);
    expect(ersteRunde.due).toBe(true);
    expect(ersteRunde.slot).toBe("2026-10-25");

    // Zweiter Durchlauf von 02:30 Ortszeit (= 01:30 UTC, jetzt Winterzeit).
    const zweiteRunde = isDue(
      nachts,
      new Date("2026-10-25T01:30:00Z"),
      ersteRunde.slot,
    );
    expect(zweiteRunde.due).toBe(false);
  });

  /*
   * Beim Vorstellen der Uhr am 29.03.2026 wird 02:00 auf 03:00 gesetzt — die
   * Stunde 02:00–02:59 existiert nicht. Ein Zeitplan um 02:30 darf deswegen
   * nicht ausfallen: Er läuft, sobald die Ortszeit die Uhrzeit überschritten
   * hat, in diesem Fall also um 03:00.
   */
  it("lässt beim Vorstellen der Uhr keinen Lauf ausfallen", () => {
    const nachts = spec({ hour: 2, minute: 30 });
    // 01:00 UTC = 03:00 Ortszeit; die Zeit 02:30 wurde übersprungen.
    const result = isDue(nachts, new Date("2026-03-29T01:00:00Z"), null);
    expect(result.due).toBe(true);
    expect(result.slot).toBe("2026-03-29");
  });

  it("richtet sich nach der Zeitzone der Organisation, nicht nach der Serverzeit", () => {
    // 12:00 UTC ist in New York 08:00, in Berlin 14:00.
    const newYork = spec({ timezone: "America/New_York", hour: 9 });
    const berlin = spec({ timezone: "Europe/Berlin", hour: 9 });
    const now = new Date("2026-07-27T12:00:00Z");
    // In New York ist 09:00 noch nicht erreicht, in Berlin längst vorbei.
    expect(isDue(newYork, now, null).due).toBe(false);
    expect(isDue(berlin, now, null).due).toBe(true);
  });
});

describe("Hilfsfunktionen", () => {
  it("erkennt gültige und ungültige Zeitzonen", () => {
    expect(isValidTimeZone("Europe/Berlin")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Mittelerde/Bruchtal")).toBe(false);
  });

  it("beschreibt Zeitpläne lesbar und nennt die Zeitzone", () => {
    expect(describeSchedule(spec())).toBe("täglich um 07:00 (Europe/Berlin)");
    expect(describeSchedule(spec({ frequency: "weekday", hour: 8, minute: 30 }))).toBe(
      "montags bis freitags um 08:30 (Europe/Berlin)",
    );
    expect(
      describeSchedule(spec({ frequency: "weekly", weekday: 3, hour: 16 })),
    ).toBe("jeden Mittwoch um 16:00 (Europe/Berlin)");
    expect(describeSchedule(spec({ frequency: "hourly", minute: 5 }))).toBe(
      "stündlich zur Minute 05 (Europe/Berlin)",
    );
  });
});
