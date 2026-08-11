import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { BOOKING_STORAGE_KEY, BOOKING_STORAGE_VERSION } from "../constants";
import { bookingRecordSchema } from "../schema";
import { Booking } from "../types";

export function migrateLegacyBookingRecords(records: unknown[]): unknown[] {
  const migratedAt = Date.now();
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const booking = record as Record<string, unknown>;
    const bookingDate = booking.bookingDate ?? booking.date;
    const createdAt = booking.createdAt ?? migratedAt;
    const bookingId = typeof booking.id === "string" ? booking.id : "";
    const startTime = typeof booking.startTime === "string" ? booking.startTime : "00:00";
    const endTime = typeof booking.endTime === "string" ? booking.endTime : startTime;
    const start = new Date(`${bookingDate}T${startTime}:00`);
    const end = new Date(`${bookingDate}T${endTime}:00`);
    if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
    const existingSessions = Array.isArray(booking.sessions) ? booking.sessions : null;
    const {
      bookingDate: _bookingDate,
      date: _date,
      startTime: _startTime,
      endTime: _endTime,
      location: _location,
      sessions: _sessions,
      ...bookingFields
    } = booking;
    void _bookingDate;
    void _date;
    void _startTime;
    void _endTime;
    void _location;
    void _sessions;

    return {
      ...bookingFields,
      sessions: existingSessions ?? [{
        id: bookingId,
        bookingId,
        sequence: 1,
        label: "",
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        location: booking.location ?? "",
        notes: "",
        createdAt,
        updatedAt: booking.updatedAt ?? createdAt,
      }],
      bookingStatus: booking.bookingStatus ?? booking.status ?? "Scheduled",
      servicePrice: booking.servicePrice ?? 0,
      fullPaymentDueDate: booking.fullPaymentDueDate ?? bookingDate,
      notes: booking.notes ?? "",
      createdAt,
      updatedAt: booking.updatedAt ?? createdAt,
    };
  });
}

export const localStorageRepository = {
  getAll(): Booking[] {
    return readVersionedCollection(BOOKING_STORAGE_KEY, bookingRecordSchema, {
      version: BOOKING_STORAGE_VERSION,
      migrateLegacy: migrateLegacyBookingRecords,
      migrateVersioned: migrateLegacyBookingRecords,
    });
  },

  save(bookings: Booking[]): void {
    writeVersionedCollection(BOOKING_STORAGE_KEY, bookingRecordSchema, bookings, {
      version: BOOKING_STORAGE_VERSION,
    });
  },
};
