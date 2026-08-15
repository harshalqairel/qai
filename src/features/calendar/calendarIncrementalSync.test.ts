import { describe, expect, it } from "vitest";

import type { Booking } from "@/features/booking/types";
import { calendarRelevantSessionIds } from "./calendarIncrementalSync";

const booking: Booking = {
  id: "booking-1",
  customerId: "customer-1",
  serviceId: "service-1",
  sessions: [
    { id: "session-1", bookingId: "booking-1", sequence: 1, label: "Akad", startAt: "2026-08-12T01:00:00.000Z", endAt: "2026-08-12T03:00:00.000Z", location: "Bandung", notes: "", createdAt: 1, updatedAt: 1 },
    { id: "session-2", bookingId: "booking-1", sequence: 2, label: "Reception", startAt: "2026-08-15T10:00:00.000Z", endAt: "2026-08-15T13:00:00.000Z", location: "Jakarta", notes: "", createdAt: 1, updatedAt: 1 },
  ],
  servicePrice: 7_500_000,
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "2026-08-15",
  notes: "Private booking note",
  createdAt: 1,
  updatedAt: 1,
};

describe("calendarRelevantSessionIds", () => {
  it("targets only the session whose Calendar fields changed", () => {
    const updated = { ...booking, sessions: booking.sessions.map((session) => session.id === "session-2" ? { ...session, location: "Bogor" } : session) };
    expect(calendarRelevantSessionIds(booking, updated)).toEqual(["session-2"]);
  });

  it("ignores payment, pricing, due-date, and unrelated note changes", () => {
    const updated = { ...booking, servicePrice: 8_000_000, fullPaymentDueDate: "2026-08-20", notes: "Changed" };
    expect(calendarRelevantSessionIds(booking, updated)).toEqual([]);
  });

  it("targets every session for cancellation and includes removed schedules", () => {
    expect(calendarRelevantSessionIds(booking, { ...booking, bookingStatus: "Cancelled" })).toEqual(["session-1", "session-2"]);
    expect(calendarRelevantSessionIds(booking, { ...booking, sessions: booking.sessions.slice(0, 1) })).toEqual(["session-2"]);
  });
});
