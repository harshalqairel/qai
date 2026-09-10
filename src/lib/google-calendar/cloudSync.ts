import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCloudAdminClient } from "@/lib/supabase/admin";
import {
  reconcileGoogleCalendar,
  type CalendarEventLink,
  type CalendarLinkStore,
  type CalendarProvider,
  type CalendarSyncSource,
  type CalendarSyncSummary,
  type GoogleCalendarEventPayload,
} from "./reconciliation";
import {
  CloudCalendarError,
  cloudGoogleCalendarAccess,
  getCloudCalendarIntegration,
  markCloudGoogleCalendarReconnectRequired,
  updateCloudCalendarIntegration,
} from "./cloudConnection";
import {
  googleCalendarApi,
  GoogleCalendarApiError,
  type GoogleCalendarList,
} from "./googleApi";

type DatabaseRow = Record<string, unknown>;

const LINK_COLUMNS = [
  "id",
  "source_booking_session_id",
  "booking_session_id",
  "external_calendar_id",
  "external_event_id",
  "last_payload_hash",
  "sync_status",
].join(",");

function stringValue(row: DatabaseRow, key: string): string {
  return typeof row[key] === "string" ? row[key] as string : "";
}

function linkFromRow(row: DatabaseRow): CalendarEventLink {
  return {
    id: stringValue(row, "id"),
    sourceSessionId: stringValue(row, "source_booking_session_id"),
    bookingSessionId: typeof row.booking_session_id === "string" ? row.booking_session_id : null,
    externalCalendarId: stringValue(row, "external_calendar_id"),
    externalEventId: stringValue(row, "external_event_id"),
    lastPayloadHash: typeof row.last_payload_hash === "string" ? row.last_payload_hash : null,
    syncStatus: stringValue(row, "sync_status") as CalendarEventLink["syncStatus"],
  };
}

function providerFor(accessToken: string): CalendarProvider {
  return {
    async getEvent(calendarId, eventId) {
      return googleCalendarApi<{ id: string; status?: string }>(
        accessToken,
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      );
    },
    async insertEvent(calendarId, eventId, payload) {
      return googleCalendarApi<{ id: string }>(
        accessToken,
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        { method: "POST", body: JSON.stringify({ id: eventId, ...payload }) },
      );
    },
    async updateEvent(calendarId, eventId, payload) {
      return googleCalendarApi<{ id: string }>(
        accessToken,
        `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { method: "PUT", body: JSON.stringify(payload) },
      );
    },
    async deleteEvent(calendarId, eventId) {
      try {
        await googleCalendarApi<void>(
          accessToken,
          `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
          { method: "DELETE" },
        );
      } catch (error) {
        if (error instanceof GoogleCalendarApiError && (error.status === 404 || error.status === 410)) return;
        throw error;
      }
    },
  };
}

function storeFor(
  admin: SupabaseClient,
  businessId: string,
  integrationId: string,
): CalendarLinkStore {
  return {
    async createPending(input) {
      const { data, error } = await admin
        .from("calendar_event_links")
        .upsert({
          business_id: businessId,
          integration_id: integrationId,
          source_booking_session_id: input.sourceSessionId,
          booking_session_id: input.bookingSessionId,
          external_calendar_id: input.externalCalendarId,
          external_event_id: input.externalEventId,
          sync_status: "pending",
          last_payload_hash: null,
          last_error: null,
          last_synced_at: null,
        }, { onConflict: "integration_id,source_booking_session_id" })
        .select(LINK_COLUMNS)
        .single();
      if (error || !data) throw new Error("Calendar event link could not be saved.");
      return linkFromRow(data as unknown as DatabaseRow);
    },
    async markSynced(linkId, input) {
      const { error } = await admin
        .from("calendar_event_links")
        .update({
          booking_session_id: input.bookingSessionId,
          external_calendar_id: input.externalCalendarId,
          external_event_id: input.externalEventId,
          last_payload_hash: input.payloadHash,
          sync_status: "synced",
          last_synced_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("business_id", businessId)
        .eq("integration_id", integrationId)
        .eq("id", linkId);
      if (error) throw new Error("Calendar event link could not be updated.");
    },
    async markError(linkId, message) {
      const { error } = await admin
        .from("calendar_event_links")
        .update({ sync_status: "error", last_error: message })
        .eq("business_id", businessId)
        .eq("integration_id", integrationId)
        .eq("id", linkId);
      if (error) throw new Error("Calendar event error could not be saved.");
    },
    async remove(linkId) {
      const { error } = await admin
        .from("calendar_event_links")
        .delete()
        .eq("business_id", businessId)
        .eq("integration_id", integrationId)
        .eq("id", linkId);
      if (error) throw new Error("Calendar event link could not be removed.");
    },
  };
}

async function rowsFrom(
  promise: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<DatabaseRow[]> {
  const result = await promise;
  if (result.error) throw new CloudCalendarError("storage_error", "Qai schedules could not be loaded.", 500);
  return Array.isArray(result.data) ? result.data as DatabaseRow[] : [];
}

function serviceSnapshotName(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const name = (value as { serviceName?: unknown }).serviceName;
  return typeof name === "string" ? name : "";
}

async function loadSources(
  client: SupabaseClient,
  businessId: string,
): Promise<CalendarSyncSource[]> {
  const [bookings, sessions, customers, services] = await Promise.all([
    rowsFrom(client.from("bookings").select("id,customer_id,service_id,service_snapshot,booking_status").eq("business_id", businessId)),
    rowsFrom(client.from("booking_sessions").select("id,booking_id,label,start_at,end_at,location").eq("business_id", businessId)),
    rowsFrom(client.from("customers").select("id,name").eq("business_id", businessId)),
    rowsFrom(client.from("services").select("id,name").eq("business_id", businessId)),
  ]);
  const bookingById = new Map(bookings.map((row) => [stringValue(row, "id"), row]));
  const customerById = new Map(customers.map((row) => [stringValue(row, "id"), stringValue(row, "name")]));
  const serviceById = new Map(services.map((row) => [stringValue(row, "id"), stringValue(row, "name")]));

  return sessions.flatMap((session): CalendarSyncSource[] => {
    const booking = bookingById.get(stringValue(session, "booking_id"));
    if (!booking) return [];
    const bookingStatus = stringValue(booking, "booking_status");
    if (bookingStatus !== "Scheduled" && bookingStatus !== "Completed" && bookingStatus !== "Cancelled") return [];
    const snapshotName = serviceSnapshotName(booking.service_snapshot);
    return [{
      sessionId: stringValue(session, "id"),
      bookingStatus,
      label: stringValue(session, "label"),
      startAt: stringValue(session, "start_at"),
      endAt: stringValue(session, "end_at"),
      location: stringValue(session, "location"),
      clientName: customerById.get(stringValue(booking, "customer_id")) ?? "Client",
      serviceName: snapshotName || serviceById.get(stringValue(booking, "service_id")) || "Qai booking",
    }];
  });
}

async function loadLinks(
  admin: SupabaseClient,
  businessId: string,
  integrationId: string,
): Promise<CalendarEventLink[]> {
  const { data, error } = await admin
    .from("calendar_event_links")
    .select(LINK_COLUMNS)
    .eq("business_id", businessId)
    .eq("integration_id", integrationId);
  if (error) throw new CloudCalendarError("storage_error", "Calendar event links could not be loaded.", 500);
  return (Array.isArray(data) ? data : []).map((row) => linkFromRow(row as unknown as DatabaseRow));
}

function writableDestination(list: GoogleCalendarList, destinationId: string): boolean {
  return (list.items ?? []).some((item) => item.id === destinationId
    && (item.accessRole === "owner" || item.accessRole === "writer"));
}

export async function synchronizeCloudGoogleCalendar(input: {
  client: SupabaseClient;
  businessId: string;
  timezone: string;
  requestedSessionIds?: ReadonlySet<string> | null;
}): Promise<CalendarSyncSummary> {
  const initialIntegration = await getCloudCalendarIntegration(input.businessId);
  if (!initialIntegration || initialIntegration.status === "disconnected") {
    throw new CloudCalendarError("not_connected", "Google Calendar is not connected.", 409);
  }
  const attemptedAt = new Date().toISOString();
  await updateCloudCalendarIntegration(input.businessId, initialIntegration.id, {
    last_sync_attempt_at: attemptedAt,
  });

  try {
    const access = await cloudGoogleCalendarAccess(input.businessId);
    const integration = access.integration;
    const destinationId = integration.destination_id?.trim();
    if (!destinationId) {
      throw new CloudCalendarError("calendar_unavailable", "Choose a Google Calendar before syncing.", 409);
    }
    const calendars = await googleCalendarApi<GoogleCalendarList>(
      access.accessToken,
      "/users/me/calendarList?minAccessRole=writer",
    );
    if (!writableDestination(calendars, destinationId)) {
      await updateCloudCalendarIntegration(input.businessId, integration.id, {
        status: "error",
        last_error: "Your selected calendar is no longer available.",
      });
      throw new CloudCalendarError(
        "calendar_unavailable",
        "Your selected calendar is no longer available.",
        409,
      );
    }

    const admin = createCloudAdminClient();
    const [sources, links] = await Promise.all([
      loadSources(input.client, input.businessId),
      loadLinks(admin, input.businessId, integration.id),
    ]);
    const summary = await reconcileGoogleCalendar({
      integrationId: integration.id,
      businessId: input.businessId,
      timezone: input.timezone,
      destinationCalendarId: destinationId,
      sources,
      links,
      requestedSessionIds: input.requestedSessionIds,
      provider: providerFor(access.accessToken),
      store: storeFor(admin, input.businessId, integration.id),
    });

    if (summary.failed > 0) {
      await updateCloudCalendarIntegration(input.businessId, integration.id, {
        status: "error",
        last_error: "Some schedules could not be synced.",
      });
      return summary;
    }

    await updateCloudCalendarIntegration(input.businessId, integration.id, {
      status: "connected",
      last_sync_at: new Date().toISOString(),
      last_error: null,
    });
    return summary;
  } catch (error) {
    if (error instanceof GoogleCalendarApiError && (error.status === 401 || error.status === 403)) {
      await markCloudGoogleCalendarReconnectRequired(input.businessId, initialIntegration.id);
      throw new CloudCalendarError("reconnect_required", "Google Calendar needs to be reconnected.", 409);
    }
    if (error instanceof CloudCalendarError) {
      if (error.code !== "reconnect_required" && error.code !== "not_connected") {
        await updateCloudCalendarIntegration(input.businessId, initialIntegration.id, {
          status: "error",
          last_error: error.message,
        }).catch(() => undefined);
      }
    } else {
      await updateCloudCalendarIntegration(input.businessId, initialIntegration.id, {
        status: "error",
        last_error: "Google Calendar could not be synced.",
      }).catch(() => undefined);
    }
    throw error;
  }
}

export function isPartialCalendarSync(summary: CalendarSyncSummary): boolean {
  return summary.failed > 0;
}

export type { GoogleCalendarEventPayload };
