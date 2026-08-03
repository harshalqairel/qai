import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { BOOKING_STORAGE_KEY } from "../constants";
import { bookingRecordSchema } from "../schema";
import { Booking } from "../types";

function migrateLegacyBookings(records: unknown[]): unknown[] {
  const migratedAt = Date.now();
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const booking = record as Record<string, unknown>;
    const bookingDate = booking.bookingDate ?? booking.date;
    const createdAt = booking.createdAt ?? migratedAt;

    return {
      ...booking,
      bookingDate,
      bookingStatus: booking.bookingStatus ?? booking.status ?? "Scheduled",
      location: booking.location ?? "",
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
      migrateLegacy: migrateLegacyBookings,
    });
  },

  save(bookings: Booking[]): void {
    writeVersionedCollection(BOOKING_STORAGE_KEY, bookingRecordSchema, bookings);
  },
};
