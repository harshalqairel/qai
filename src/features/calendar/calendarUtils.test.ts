import { describe, expect, it } from "vitest";
import type { Booking, BookingSession } from "@/features/booking/types";
import type { CalendarBooking } from "./types";
import { calendarDateKey, getMonthGridDays, groupCalendarBookingsByDate, shiftMonthClamped } from "./calendarUtils";

function session(bookingId: string, sequence: number, date: string): BookingSession {
  return { id: `${bookingId}-${sequence}`, bookingId, sequence, label: "", startAt: `${date}T02:00:00.000Z`, endAt: `${date}T03:00:00.000Z`, location: "", notes: "", createdAt: 1, updatedAt: 1 };
}

function calendarBooking(parent: Booking, item: BookingSession, date: string): CalendarBooking {
  return { ...parent, session: item, bookingDate: date, startTime: "09:00", endTime: "10:00", location: "", customerName: "Sarah", serviceName: "Wedding", categoryColor: "category-mauve" };
}

describe("mobile calendar month domain", () => {
  it("builds a complete six-week grid with adjacent-month dates", () => {
    const days = getMonthGridDays(new Date(2026, 7, 18));
    expect(days).toHaveLength(42);
    expect(calendarDateKey(days[0])).toBe("2026-07-26");
    expect(calendarDateKey(days[41])).toBe("2026-09-05");
  });

  it("clamps month navigation across Aug 31 and shorter months", () => {
    expect(calendarDateKey(shiftMonthClamped(new Date(2026, 7, 31), 1))).toBe("2026-09-30");
    expect(calendarDateKey(shiftMonthClamped(new Date(2026, 2, 31), -1))).toBe("2026-02-28");
  });

  it("marks every non-consecutive session while preserving one parent booking", () => {
    const bookingId = "booking-1";
    const sessions = [session(bookingId, 1, "2026-08-12"), session(bookingId, 2, "2026-08-15"), session(bookingId, 3, "2026-08-20")];
    const parent: Booking = { id: bookingId, customerId: "c", serviceId: "s", sessions, servicePrice: 1, bookingStatus: "Scheduled", fullPaymentDueDate: "2026-08-20", notes: "", createdAt: 1, updatedAt: 1 };
    const grouped = groupCalendarBookingsByDate(sessions.map((item, index) => calendarBooking(parent, item, ["2026-08-12", "2026-08-15", "2026-08-20"][index])));
    expect([...grouped.keys()]).toEqual(["2026-08-12", "2026-08-15", "2026-08-20"]);
    expect(grouped.get("2026-08-15")?.[0].id).toBe(bookingId);
    expect(grouped.get("2026-08-15")?.[0].session.sequence).toBe(2);
  });

  it("supports empty, single, and several-session selected days", () => {
    const grouped = new Map<string, CalendarBooking[]>();
    expect(grouped.get("2026-08-18") ?? []).toHaveLength(0);
    grouped.set("2026-08-18", [{} as CalendarBooking]);
    expect(grouped.get("2026-08-18")).toHaveLength(1);
    grouped.set("2026-08-18", [{}, {}, {}] as CalendarBooking[]);
    expect(grouped.get("2026-08-18")).toHaveLength(3);
  });
});
