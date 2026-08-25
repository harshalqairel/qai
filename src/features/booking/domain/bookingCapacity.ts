import type { Booking, BookingSession } from "@/features/booking/types";

export function reconcileBookingCapacitySlotKeys(
  current: Pick<Booking, "sessions" | "capacitySlotKeys">,
  nextSessions: readonly BookingSession[],
): string[] {
  const keys = current.capacitySlotKeys ?? [];
  const keyByUnchangedSession = new Map<string, string>();
  current.sessions.forEach((session, index) => {
    const key = keys[index];
    if (key) keyByUnchangedSession.set(session.id, key);
  });

  return nextSessions.flatMap((session) => {
    const previous = current.sessions.find((candidate) => candidate.id === session.id);
    const key = keyByUnchangedSession.get(session.id);
    return previous && key && previous.startAt === session.startAt && previous.endAt === session.endAt ? [key] : [];
  });
}
