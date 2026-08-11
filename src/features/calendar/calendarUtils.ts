import type { CalendarBooking } from "./types";
import { compareByBookingStartDateTime, getBookingCoveredDateKeys } from "@/features/booking/utils/bookingDateRange";

export function calendarDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarDateFromKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00`);
}

export function getMonthGridDays(activeDate: Date): Date[] {
  const first = new Date(activeDate.getFullYear(), activeDate.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export function shiftMonthClamped(date: Date, offset: number): Date {
  const originalDay = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + offset, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, lastDay));
  return target;
}

export function groupCalendarBookingsByDate(bookings: readonly CalendarBooking[]): Map<string, CalendarBooking[]> {
  const grouped = new Map<string, CalendarBooking[]>();
  for (const booking of bookings) {
    const coveredDates = getBookingCoveredDateKeys({ bookingDate: booking.bookingDate, startTime: booking.startTime, endTime: booking.endTime });
    for (const dateKey of coveredDates) {
      const items = grouped.get(dateKey) ?? [];
      items.push(booking);
      grouped.set(dateKey, items);
    }
  }
  for (const [dateKey, items] of grouped) grouped.set(dateKey, [...items].sort(compareByBookingStartDateTime));
  return grouped;
}
