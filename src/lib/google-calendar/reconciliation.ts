import "server-only";

import { createHash } from "node:crypto";

export type GoogleCalendarEventPayload = {
  status?: "confirmed";
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
};

export type GoogleCalendarEventRecord = {
  id: string;
  status?: string;
};

export type CalendarSyncSource = {
  sessionId: string;
  bookingStatus: "Scheduled" | "Completed" | "Cancelled";
  label: string;
  startAt: string;
  endAt: string;
  location: string;
  clientName: string;
  serviceName: string;
};

export type CalendarEventLink = {
  id: string;
  sourceSessionId: string;
  bookingSessionId: string | null;
  externalCalendarId: string;
  externalEventId: string;
  lastPayloadHash: string | null;
  syncStatus: "pending" | "synced" | "error" | "cancelled";
};

export type CalendarSyncSummary = {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  skipped: number;
  failed: number;
};

export type CalendarProvider = {
  getEvent(calendarId: string, eventId: string): Promise<GoogleCalendarEventRecord | null>;
  insertEvent(calendarId: string, eventId: string, payload: GoogleCalendarEventPayload): Promise<{ id: string }>;
  updateEvent(calendarId: string, eventId: string, payload: GoogleCalendarEventPayload): Promise<{ id: string }>;
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
};

export type CalendarLinkStore = {
  createPending(input: {
    sourceSessionId: string;
    bookingSessionId: string;
    externalCalendarId: string;
    externalEventId: string;
  }): Promise<CalendarEventLink>;
  markSynced(linkId: string, input: {
    bookingSessionId: string;
    externalCalendarId: string;
    externalEventId: string;
    payloadHash: string;
  }): Promise<void>;
  markError(linkId: string, message: string): Promise<void>;
  remove(linkId: string): Promise<void>;
};

export type ReconcileGoogleCalendarInput = {
  integrationId: string;
  businessId: string;
  timezone: string;
  destinationCalendarId: string;
  sources: CalendarSyncSource[];
  links: CalendarEventLink[];
  requestedSessionIds?: ReadonlySet<string> | null;
  now?: Date;
  provider: CalendarProvider;
  store: CalendarLinkStore;
};

type ProviderFailure = Error & { status?: number };

const RECENT_SESSION_GRACE_MS = 24 * 60 * 60 * 1_000;
const LINK_ERROR = "Schedule could not be synced.";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function deterministicGoogleEventId(
  businessId: string,
  integrationId: string,
  sourceSessionId: string,
): string {
  // Hex is a strict subset of Google's base32hex event-ID alphabet (0-9, a-v).
  const digest = createHash("sha256")
    .update(`qai-google-calendar-event:v1:${businessId}:${integrationId}:${sourceSessionId}`)
    .digest("hex");
  return `qai${digest}`;
}

export function buildGoogleCalendarEvent(
  source: CalendarSyncSource,
  timezone: string,
): GoogleCalendarEventPayload {
  const description = source.label.trim()
    ? `Scheduled from Qai · ${source.label.trim()}`
    : "Scheduled from Qai";

  return {
    summary: `${source.serviceName.trim() || "Qai booking"} · ${source.clientName.trim() || "Client"}`,
    description,
    ...(source.location.trim() ? { location: source.location.trim() } : {}),
    start: { dateTime: source.startAt, timeZone: timezone },
    end: { dateTime: source.endAt, timeZone: timezone },
  };
}

export function googleCalendarPayloadHash(payload: GoogleCalendarEventPayload): string {
  return sha256(JSON.stringify(payload));
}

function providerStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as ProviderFailure).status;
  return typeof status === "number" ? status : null;
}

function isNotFound(error: unknown): boolean {
  const status = providerStatus(error);
  return status === 404 || status === 410;
}

function isConflict(error: unknown): boolean {
  return providerStatus(error) === 409;
}

function isAmbiguousCreateFailure(error: unknown): boolean {
  const status = providerStatus(error);
  return status === null || status === 0 || status >= 500;
}

async function providerEvent(
  provider: CalendarProvider,
  calendarId: string,
  eventId: string,
): Promise<GoogleCalendarEventRecord | null> {
  try {
    return await provider.getEvent(calendarId, eventId);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function existingEvent(
  provider: CalendarProvider,
  calendarId: string,
  eventId: string,
): Promise<GoogleCalendarEventRecord | null> {
  const event = await providerEvent(provider, calendarId, eventId);
  return event?.status === "cancelled" ? null : event;
}

async function ensureDeterministicEvent(
  provider: CalendarProvider,
  calendarId: string,
  eventId: string,
  payload: GoogleCalendarEventPayload,
): Promise<{ id: string; recovered: boolean }> {
  try {
    const inserted = await provider.insertEvent(calendarId, eventId, payload);
    return { id: inserted.id || eventId, recovered: false };
  } catch (error) {
    if (!isConflict(error) && !isAmbiguousCreateFailure(error)) throw error;

    const found = await providerEvent(provider, calendarId, eventId);
    if (found) {
      if (isConflict(error) || found.status === "cancelled") {
        const restored = await provider.updateEvent(
          calendarId,
          eventId,
          found.status === "cancelled" ? { ...payload, status: "confirmed" } : payload,
        );
        return { id: restored.id || found.id || eventId, recovered: true };
      }
      return { id: found.id || eventId, recovered: true };
    }

    if (!isAmbiguousCreateFailure(error)) throw error;
    try {
      const retried = await provider.insertEvent(calendarId, eventId, payload);
      return { id: retried.id || eventId, recovered: false };
    } catch (retryError) {
      if (!isConflict(retryError)) throw retryError;
      const recovered = await providerEvent(provider, calendarId, eventId);
      if (!recovered) throw retryError;
      const restored = await provider.updateEvent(
        calendarId,
        eventId,
        recovered.status === "cancelled" ? { ...payload, status: "confirmed" } : payload,
      );
      return { id: restored.id || recovered.id || eventId, recovered: true };
    }
  }
}

function emptySummary(): CalendarSyncSummary {
  return { created: 0, updated: 0, deleted: 0, unchanged: 0, skipped: 0, failed: 0 };
}

export async function reconcileGoogleCalendar(
  input: ReconcileGoogleCalendarInput,
): Promise<CalendarSyncSummary> {
  const summary = emptySummary();
  const now = input.now ?? new Date();
  const currentSourceIds = new Set(input.sources.map((source) => source.sessionId));
  const linkBySourceId = new Map(input.links.map((link) => [link.sourceSessionId, link]));

  for (const source of input.sources) {
    if (input.requestedSessionIds && !input.requestedSessionIds.has(source.sessionId)) continue;

    let link = linkBySourceId.get(source.sessionId) ?? null;
    const startsInFuture = Date.parse(source.startAt) > now.getTime();

    if (source.bookingStatus === "Cancelled") {
      if (!link || !startsInFuture) {
        summary.skipped += 1;
        continue;
      }
      try {
        await input.provider.deleteEvent(link.externalCalendarId, link.externalEventId);
        await input.store.remove(link.id);
        linkBySourceId.delete(source.sessionId);
        summary.deleted += 1;
      } catch {
        await input.store.markError(link.id, LINK_ERROR);
        summary.failed += 1;
      }
      continue;
    }

    if (!link && Date.parse(source.endAt) < now.getTime() - RECENT_SESSION_GRACE_MS) {
      summary.skipped += 1;
      continue;
    }

    const payload = buildGoogleCalendarEvent(source, input.timezone);
    const payloadHash = googleCalendarPayloadHash(payload);
    const deterministicId = deterministicGoogleEventId(
      input.businessId,
      input.integrationId,
      source.sessionId,
    );

    try {
      if (!link) {
        link = await input.store.createPending({
          sourceSessionId: source.sessionId,
          bookingSessionId: source.sessionId,
          externalCalendarId: input.destinationCalendarId,
          externalEventId: deterministicId,
        });
        linkBySourceId.set(source.sessionId, link);
        const created = await ensureDeterministicEvent(
          input.provider,
          input.destinationCalendarId,
          deterministicId,
          payload,
        );
        await input.store.markSynced(link.id, {
          bookingSessionId: source.sessionId,
          externalCalendarId: input.destinationCalendarId,
          externalEventId: created.id,
          payloadHash,
        });
        summary.created += 1;
        continue;
      }

      if (link.externalCalendarId !== input.destinationCalendarId) {
        // Keep the old mapping intact unless its event is removed successfully.
        await input.provider.deleteEvent(link.externalCalendarId, link.externalEventId);
        const created = await ensureDeterministicEvent(
          input.provider,
          input.destinationCalendarId,
          deterministicId,
          payload,
        );
        await input.store.markSynced(link.id, {
          bookingSessionId: source.sessionId,
          externalCalendarId: input.destinationCalendarId,
          externalEventId: created.id,
          payloadHash,
        });
        summary.updated += 1;
        continue;
      }

      if (link.lastPayloadHash === payloadHash) {
        const found = await existingEvent(
          input.provider,
          link.externalCalendarId,
          link.externalEventId,
        );
        if (found) {
          await input.store.markSynced(link.id, {
            bookingSessionId: source.sessionId,
            externalCalendarId: link.externalCalendarId,
            externalEventId: link.externalEventId,
            payloadHash,
          });
          summary.unchanged += 1;
          continue;
        }

        const restored = await ensureDeterministicEvent(
          input.provider,
          input.destinationCalendarId,
          deterministicId,
          payload,
        );
        await input.store.markSynced(link.id, {
          bookingSessionId: source.sessionId,
          externalCalendarId: input.destinationCalendarId,
          externalEventId: restored.id,
          payloadHash,
        });
        summary.created += 1;
        continue;
      }

      try {
        const updated = await input.provider.updateEvent(
          link.externalCalendarId,
          link.externalEventId,
          payload,
        );
        await input.store.markSynced(link.id, {
          bookingSessionId: source.sessionId,
          externalCalendarId: link.externalCalendarId,
          externalEventId: updated.id || link.externalEventId,
          payloadHash,
        });
        summary.updated += 1;
      } catch (error) {
        if (!isNotFound(error)) throw error;
        const restored = await ensureDeterministicEvent(
          input.provider,
          input.destinationCalendarId,
          deterministicId,
          payload,
        );
        await input.store.markSynced(link.id, {
          bookingSessionId: source.sessionId,
          externalCalendarId: input.destinationCalendarId,
          externalEventId: restored.id,
          payloadHash,
        });
        summary.created += 1;
      }
    } catch {
      if (link) await input.store.markError(link.id, LINK_ERROR).catch(() => undefined);
      summary.failed += 1;
    }
  }

  for (const link of input.links) {
    if (currentSourceIds.has(link.sourceSessionId)) continue;
    if (input.requestedSessionIds && !input.requestedSessionIds.has(link.sourceSessionId)) continue;
    try {
      await input.provider.deleteEvent(link.externalCalendarId, link.externalEventId);
      await input.store.remove(link.id);
      summary.deleted += 1;
    } catch {
      await input.store.markError(link.id, LINK_ERROR).catch(() => undefined);
      summary.failed += 1;
    }
  }

  return summary;
}
