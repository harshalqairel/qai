import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { bookingRecordSchema } from "@/features/booking/schema";
import { customerRecordSchema } from "@/features/customer/schema";
import { serviceRecordSchema } from "@/features/service/schema";
import { createValidationAdminClient } from "@/lib/validation/admin";
import { googleApi, workspaceGoogleAccessToken } from "@/lib/validation/googleCalendar";
import { requireValidationSession } from "@/lib/validation/session";

type Envelope = { data?: unknown };
type GoogleEvent = { id: string };

function documentRecords(value: unknown): unknown[] { if (!value || typeof value !== "object") return []; const data = (value as Envelope).data; return Array.isArray(data) ? data : []; }
function payloadHash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("base64url"); }

export async function POST() {
  try {
    const session = await requireValidationSession(); const admin = createValidationAdminClient(); const { accessToken, calendarId } = await workspaceGoogleAccessToken(session.workspaceId);
    const { data: documents } = await admin.from("validation_workspace_documents").select("storage_key, value").eq("workspace_id", session.workspaceId).in("storage_key", ["qai:bookings", "qai:customers", "qai:services"]);
    const byKey = new Map((documents ?? []).map((item) => [item.storage_key, item.value]));
    const bookings = bookingRecordSchema.array().parse(documentRecords(byKey.get("qai:bookings"))); const customers = customerRecordSchema.array().parse(documentRecords(byKey.get("qai:customers"))); const services = serviceRecordSchema.array().parse(documentRecords(byKey.get("qai:services")));
    const customerById = new Map(customers.map((item) => [item.id, item])); const serviceById = new Map(services.map((item) => [item.id, item]));
    const { data: links } = await admin.from("validation_calendar_event_links").select("*").eq("workspace_id", session.workspaceId); const linkBySchedule = new Map((links ?? []).map((link) => [link.schedule_id, link]));
    const activeScheduleIds = new Set<string>(); const now = Date.now(); const summary = { created: 0, updated: 0, cancelled: 0, unchanged: 0, skipped: 0, failed: 0 };

    for (const booking of bookings) for (const schedule of booking.sessions) {
      activeScheduleIds.add(schedule.id); const link = linkBySchedule.get(schedule.id); const future = Date.parse(schedule.startAt) > now;
      if (booking.bookingStatus === "Cancelled") {
        if (link && future && !link.cancelled_at) { try { await googleApi<void>(accessToken, `/calendars/${encodeURIComponent(link.google_calendar_id)}/events/${encodeURIComponent(link.google_event_id)}`, { method: "DELETE" }); const { error } = await admin.from("validation_calendar_event_links").update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId).eq("schedule_id", schedule.id); if (error) throw error; summary.cancelled += 1; } catch { summary.failed += 1; } } else summary.skipped += 1; continue;
      }
      if (!link && Date.parse(schedule.endAt) < now - 24 * 60 * 60 * 1000) { summary.skipped += 1; continue; }
      const customer = customerById.get(booking.customerId); const service = serviceById.get(booking.serviceId);
      const event = { summary: `${service?.name ?? "Qai booking"} — ${customer?.name ?? "Client"}`, location: schedule.location || undefined,
        description: [`Qai booking${schedule.label ? ` · ${schedule.label}` : ""}`, customer?.phone ? `Client: ${customer.name} (${customer.phone})` : customer?.name ? `Client: ${customer.name}` : "", booking.notes].filter(Boolean).join("\n"),
        start: { dateTime: schedule.startAt }, end: { dateTime: schedule.endAt }, extendedProperties: { private: { qaiBookingId: booking.id, qaiScheduleId: schedule.id } } };
      const hash = payloadHash(event);
      try {
        if (link && !link.cancelled_at && link.google_calendar_id === calendarId) {
          if (link.last_payload_hash === hash) { summary.unchanged += 1; continue; }
          try {
            await googleApi<GoogleEvent>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(link.google_event_id)}`, { method: "PUT", body: JSON.stringify(event) });
            const { error } = await admin.from("validation_calendar_event_links").update({ last_payload_hash: hash, updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId).eq("schedule_id", schedule.id); if (error) throw error; summary.updated += 1;
          } catch (error) {
            if (!(error instanceof Error) || !/\((?:404|410)\)/.test(error.message)) throw error;
            const recreated = await googleApi<GoogleEvent>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(event) });
            const { error: linkError } = await admin.from("validation_calendar_event_links").update({ google_event_id: recreated.id, last_payload_hash: hash, updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId).eq("schedule_id", schedule.id);
            if (linkError) { await googleApi<void>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(recreated.id)}`, { method: "DELETE" }).catch(() => undefined); throw linkError; }
            summary.created += 1;
          }
        } else {
          if (link && !link.cancelled_at) await googleApi<void>(accessToken, `/calendars/${encodeURIComponent(link.google_calendar_id)}/events/${encodeURIComponent(link.google_event_id)}`, { method: "DELETE" }).catch(() => undefined);
          const created = await googleApi<GoogleEvent>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, { method: "POST", body: JSON.stringify(event) });
          const { error } = await admin.from("validation_calendar_event_links").upsert({ workspace_id: session.workspaceId, booking_id: booking.id, schedule_id: schedule.id, google_calendar_id: calendarId, google_event_id: created.id, last_payload_hash: hash, cancelled_at: null, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,schedule_id" });
          if (error) { await googleApi<void>(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(created.id)}`, { method: "DELETE" }).catch(() => undefined); throw error; }
          summary.created += 1;
        }
      } catch { summary.failed += 1; }
    }

    for (const link of links ?? []) if (!activeScheduleIds.has(link.schedule_id) && !link.cancelled_at) { try { await googleApi<void>(accessToken, `/calendars/${encodeURIComponent(link.google_calendar_id)}/events/${encodeURIComponent(link.google_event_id)}`, { method: "DELETE" }); const { error } = await admin.from("validation_calendar_event_links").update({ cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId).eq("schedule_id", link.schedule_id); if (error) throw error; summary.cancelled += 1; } catch { summary.failed += 1; } }
    const { error: statusError } = await admin.from("validation_calendar_connections").update({ last_sync_at: new Date().toISOString(), last_error: summary.failed ? `${summary.failed} event operations failed` : null, updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId);
    if (statusError) throw statusError;
    return NextResponse.json({ data: summary });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Google Calendar sync failed." }, { status: 400 }); }
}
