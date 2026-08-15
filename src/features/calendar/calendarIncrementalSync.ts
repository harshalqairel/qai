import type { Booking } from "@/features/booking/types";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { flushWorkspaceDocuments } from "@/lib/validation/workspaceSync";

const BOOKING_STORAGE_KEY = "qai:bookings";

function scheduleFingerprint(schedule: Booking["sessions"][number]): string {
  return JSON.stringify({
    label: schedule.label,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    location: schedule.location,
  });
}

export function calendarRelevantSessionIds(previous: Booking, next: Booking): string[] {
  const previousById = new Map(previous.sessions.map((session) => [session.id, session]));
  const nextById = new Map(next.sessions.map((session) => [session.id, session]));
  const allIds = new Set([...previousById.keys(), ...nextById.keys()]);
  const identityChanged = previous.customerId !== next.customerId || previous.serviceId !== next.serviceId;
  const cancellationChanged = previous.bookingStatus === "Cancelled" || next.bookingStatus === "Cancelled"
    ? previous.bookingStatus !== next.bookingStatus
    : false;

  return [...allIds].filter((id) => {
    if (identityChanged || cancellationChanged) return true;
    const before = previousById.get(id);
    const after = nextById.get(id);
    return !before || !after || scheduleFingerprint(before) !== scheduleFingerprint(after);
  });
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function synchronizeAffectedCalendarSessions(scheduleIds: readonly string[]): Promise<void> {
  const uniqueIds = [...new Set(scheduleIds.filter(Boolean))];
  if (!uniqueIds.length || !isValidationModeEnabled() || typeof window === "undefined") return;

  let lastError: unknown;
  for (const delay of [0, 1_000, 4_000]) {
    if (delay) await wait(delay);
    try {
      await flushWorkspaceDocuments([BOOKING_STORAGE_KEY]);
      const response = await fetch("/api/integrations/google-calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleIds: uniqueIds }),
      });
      if (!response.ok) throw new Error(`Calendar sync request failed (${response.status}).`);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  console.warn("[QAI_CALENDAR_SYNC] affected session sync deferred", {
    scheduleCount: uniqueIds.length,
    message: lastError instanceof Error ? lastError.message : "Unknown Calendar sync error",
  });
}
