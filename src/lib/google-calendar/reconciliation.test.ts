import { describe, expect, it, vi } from "vitest";

import {
  buildGoogleCalendarEvent,
  deterministicGoogleEventId,
  googleCalendarPayloadHash,
  reconcileGoogleCalendar,
  type CalendarEventLink,
  type CalendarLinkStore,
  type CalendarProvider,
  type CalendarSyncSource,
  type GoogleCalendarEventPayload,
} from "./reconciliation";

class ProviderError extends Error {
  constructor(readonly status: number) {
    super("provider failure");
  }
}

function source(id = "00000000-0000-4000-8000-000000000001"): CalendarSyncSource {
  return {
    sessionId: id,
    bookingStatus: "Scheduled",
    label: "Consultation",
    startAt: "2026-09-10T03:00:00.000Z",
    endAt: "2026-09-10T04:00:00.000Z",
    location: "Bandung",
    clientName: "Ayu",
    serviceName: "Planning Session",
  };
}

function harness() {
  const events = new Map<string, GoogleCalendarEventPayload>();
  const tombstones = new Set<string>();
  const links: CalendarEventLink[] = [];
  const calls = {
    get: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    markError: vi.fn(),
  };
  const key = (calendarId: string, eventId: string) => `${calendarId}/${eventId}`;
  const provider: CalendarProvider = {
    async getEvent(calendarId, eventId) {
      calls.get(calendarId, eventId);
      const eventKey = key(calendarId, eventId);
      if (events.has(eventKey)) return { id: eventId, status: "confirmed" };
      return tombstones.has(eventKey) ? { id: eventId, status: "cancelled" } : null;
    },
    async insertEvent(calendarId, eventId, payload) {
      calls.insert(calendarId, eventId, payload);
      const eventKey = key(calendarId, eventId);
      if (events.has(eventKey) || tombstones.has(eventKey)) throw new ProviderError(409);
      events.set(eventKey, payload);
      return { id: eventId };
    },
    async updateEvent(calendarId, eventId, payload) {
      calls.update(calendarId, eventId, payload);
      const eventKey = key(calendarId, eventId);
      if (!events.has(eventKey) && !tombstones.has(eventKey)) throw new ProviderError(404);
      tombstones.delete(eventKey);
      events.set(eventKey, payload);
      return { id: eventId };
    },
    async deleteEvent(calendarId, eventId) {
      calls.delete(calendarId, eventId);
      const eventKey = key(calendarId, eventId);
      events.delete(eventKey);
      tombstones.add(eventKey);
    },
  };
  const store: CalendarLinkStore = {
    async createPending(input) {
      const existing = links.find((link) => link.sourceSessionId === input.sourceSessionId);
      if (existing) return existing;
      const created: CalendarEventLink = {
        id: `link-${links.length + 1}`,
        sourceSessionId: input.sourceSessionId,
        bookingSessionId: input.bookingSessionId,
        externalCalendarId: input.externalCalendarId,
        externalEventId: input.externalEventId,
        lastPayloadHash: null,
        syncStatus: "pending",
      };
      links.push(created);
      return created;
    },
    async markSynced(linkId, input) {
      const link = links.find((candidate) => candidate.id === linkId)!;
      Object.assign(link, {
        bookingSessionId: input.bookingSessionId,
        externalCalendarId: input.externalCalendarId,
        externalEventId: input.externalEventId,
        lastPayloadHash: input.payloadHash,
        syncStatus: "synced",
      });
    },
    async markError(linkId, message) {
      calls.markError(linkId, message);
      const link = links.find((candidate) => candidate.id === linkId);
      if (link) link.syncStatus = "error";
    },
    async remove(linkId) {
      const index = links.findIndex((link) => link.id === linkId);
      if (index >= 0) links.splice(index, 1);
    },
  };
  async function run(sources: CalendarSyncSource[], destinationCalendarId = "primary") {
    return reconcileGoogleCalendar({
      integrationId: "00000000-0000-4000-8000-000000000010",
      businessId: "00000000-0000-4000-8000-000000000020",
      timezone: "Asia/Jakarta",
      destinationCalendarId,
      sources,
      links: [...links],
      now: new Date("2026-09-01T00:00:00.000Z"),
      provider,
      store,
    });
  }
  return { events, tombstones, links, calls, provider, store, run, key };
}

describe("Google Calendar reconciliation", () => {
  it("creates a stable privacy-preserving Google event ID", () => {
    const first = deterministicGoogleEventId("business-a", "integration-a", "session-a");
    expect(first).toBe(deterministicGoogleEventId("business-a", "integration-a", "session-a"));
    expect(first).not.toBe(deterministicGoogleEventId("business-b", "integration-a", "session-a"));
    expect(first).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(first).not.toContain("session-a");
  });

  it("builds deterministic owner-facing payloads without private or financial data", () => {
    const payload = buildGoogleCalendarEvent(source(), "Asia/Jakarta");
    expect(payload).toEqual({
      summary: "Planning Session · Ayu",
      description: "Scheduled from Qai · Consultation",
      location: "Bandung",
      start: { dateTime: "2026-09-10T03:00:00.000Z", timeZone: "Asia/Jakarta" },
      end: { dateTime: "2026-09-10T04:00:00.000Z", timeZone: "Asia/Jakarta" },
    });
    expect(JSON.stringify(payload)).not.toMatch(/phone|payment|outstanding|profit|expense|questionnaire|note/i);
    expect(googleCalendarPayloadHash(payload)).toHaveLength(43);
  });

  it("creates one event and repeated sync remains idempotent", async () => {
    const test = harness();
    expect(await test.run([source()])).toMatchObject({ created: 1, failed: 0 });
    expect(test.events.size).toBe(1);
    expect(test.links).toHaveLength(1);

    expect(await test.run([source()])).toMatchObject({ unchanged: 1, created: 0, failed: 0 });
    expect(test.events.size).toBe(1);
    expect(test.calls.insert).toHaveBeenCalledTimes(1);
  });

  it("recovers an ambiguous create without making a duplicate", async () => {
    const test = harness();
    const originalInsert = test.provider.insertEvent;
    let first = true;
    test.provider.insertEvent = vi.fn(async (calendarId, eventId, payload) => {
      if (first) {
        first = false;
        test.events.set(test.key(calendarId, eventId), payload);
        throw new ProviderError(0);
      }
      return originalInsert(calendarId, eventId, payload);
    });

    expect(await test.run([source()])).toMatchObject({ created: 1, failed: 0 });
    expect(test.events.size).toBe(1);
    expect(test.links[0]?.syncStatus).toBe("synced");
  });

  it("updates an existing event without replacing its identity", async () => {
    const test = harness();
    await test.run([source()]);
    const eventId = test.links[0]!.externalEventId;
    const changed = { ...source(), location: "Jakarta" };

    expect(await test.run([changed])).toMatchObject({ updated: 1, created: 0 });
    expect(test.links[0]!.externalEventId).toBe(eventId);
    expect(test.events.get(test.key("primary", eventId))?.location).toBe("Jakarta");
  });

  it("maps three Booking Sessions to exactly three independent events", async () => {
    const test = harness();
    const sources = [source("session-a"), source("session-b"), source("session-c")];
    expect(await test.run(sources)).toMatchObject({ created: 3, failed: 0 });
    expect(test.events.size).toBe(3);
    expect(new Set(test.links.map((link) => link.externalEventId)).size).toBe(3);

    const changed = sources.map((item) => item.sessionId === "session-b" ? { ...item, label: "Changed" } : item);
    expect(await test.run(changed)).toMatchObject({ updated: 1, unchanged: 2 });
  });

  it("deletes only the mapping whose Session was removed", async () => {
    const test = harness();
    const sources = [source("session-a"), source("session-b"), source("session-c")];
    await test.run(sources);
    expect(await test.run(sources.filter((item) => item.sessionId !== "session-b"))).toMatchObject({
      deleted: 1,
      unchanged: 2,
    });
    expect(test.links.map((link) => link.sourceSessionId).sort()).toEqual(["session-a", "session-c"]);
    expect(test.events.size).toBe(2);
  });

  it("removes a future cancelled event but keeps past history", async () => {
    const test = harness();
    await test.run([source()]);
    expect(await test.run([{ ...source(), bookingStatus: "Cancelled" }])).toMatchObject({ deleted: 1 });
    expect(test.events.size).toBe(0);

    const past = { ...source("past-session"), startAt: "2026-08-01T03:00:00.000Z", endAt: "2026-08-01T04:00:00.000Z" };
    expect(await test.run([{ ...past, bookingStatus: "Cancelled" }])).toMatchObject({ skipped: 1 });
  });

  it("moves an event only after old-calendar deletion succeeds", async () => {
    const test = harness();
    await test.run([source()], "calendar-a");
    const originalDelete = test.provider.deleteEvent;
    test.provider.deleteEvent = vi.fn(async () => { throw new ProviderError(500); });

    expect(await test.run([source()], "calendar-b")).toMatchObject({ failed: 1, updated: 0 });
    expect(test.links[0]!.externalCalendarId).toBe("calendar-a");
    expect([...test.events.keys()].some((key) => key.startsWith("calendar-b/"))).toBe(false);

    test.provider.deleteEvent = originalDelete;
    expect(await test.run([source()], "calendar-b")).toMatchObject({ updated: 1, failed: 0 });
    expect(test.links[0]!.externalCalendarId).toBe("calendar-b");
    expect(test.events.size).toBe(1);
  });

  it("restores one deterministic event when the mapped Google event is missing", async () => {
    const test = harness();
    await test.run([source()]);
    test.events.clear();

    expect(await test.run([source()])).toMatchObject({ created: 1, failed: 0 });
    expect(test.events.size).toBe(1);
    expect(test.links).toHaveLength(1);
  });

  it("treats a mapped confirmed event with an unchanged payload as a no-op", async () => {
    const test = harness();
    await test.run([source()]);

    expect(await test.run([source()])).toMatchObject({
      created: 0,
      updated: 0,
      unchanged: 1,
      failed: 0,
    });
    expect(test.calls.get).toHaveBeenCalledTimes(1);
    expect(test.calls.update).not.toHaveBeenCalled();
    expect(test.events.size).toBe(1);
  });

  it("restores a Google cancelled tombstone with the same deterministic event identity", async () => {
    const test = harness();
    await test.run([source()]);
    const eventId = test.links[0]!.externalEventId;
    const eventKey = test.key("primary", eventId);
    test.events.delete(eventKey);
    test.tombstones.add(eventKey);

    expect(await test.run([source()])).toMatchObject({ created: 1, failed: 0 });
    expect(test.links[0]!.externalEventId).toBe(eventId);
    expect(test.links[0]!.syncStatus).toBe("synced");
    expect(test.tombstones.has(eventKey)).toBe(false);
    expect(test.events.get(eventKey)?.status).toBe("confirmed");
    expect(test.calls.update).toHaveBeenCalledWith(
      "primary",
      eventId,
      expect.objectContaining({ status: "confirmed" }),
    );
  });

  it("stays idempotent after restoring a Google cancelled tombstone", async () => {
    const test = harness();
    await test.run([source()]);
    const eventId = test.links[0]!.externalEventId;
    const eventKey = test.key("primary", eventId);
    test.events.delete(eventKey);
    test.tombstones.add(eventKey);

    expect(await test.run([source()])).toMatchObject({ created: 1, failed: 0 });
    expect(await test.run([source()])).toMatchObject({ unchanged: 1, created: 0, failed: 0 });
    expect(test.links).toHaveLength(1);
    expect(test.events.size).toBe(1);
    expect(test.links[0]!.externalEventId).toBe(eventId);
  });

  it("fails reconciliation when an unchanged event lookup has a non-not-found error", async () => {
    const test = harness();
    await test.run([source()]);
    test.provider.getEvent = vi.fn(async () => { throw new ProviderError(500); });

    expect(await test.run([source()])).toMatchObject({
      created: 0,
      unchanged: 0,
      failed: 1,
    });
    expect(test.links[0]!.syncStatus).toBe("error");
    expect(test.calls.markError).toHaveBeenCalledWith("link-1", "Schedule could not be synced.");
  });

  it("records a partial failure without preventing other Sessions from syncing", async () => {
    const test = harness();
    const originalInsert = test.provider.insertEvent;
    test.provider.insertEvent = vi.fn(async (calendarId, eventId, payload) => {
      if (payload.summary.includes("Broken")) throw new ProviderError(400);
      return originalInsert(calendarId, eventId, payload);
    });
    const valid = source("session-valid");
    const broken = { ...source("session-broken"), serviceName: "Broken" };

    expect(await test.run([valid, broken])).toMatchObject({ created: 1, failed: 1 });
    expect(test.events.size).toBe(1);
    expect(test.calls.markError).toHaveBeenCalledWith("link-2", "Schedule could not be synced.");
  });
});
