import { Booking } from "../types";
import { BOOKING_STORAGE_KEY } from "../constants";

function normalizeBooking(raw: any): Booking | null {
  if (!raw || typeof raw !== "object") return null;

  const bookingDate = String(raw.bookingDate ?? raw.date ?? "");
  const bookingStatus = String(raw.bookingStatus ?? raw.status ?? "Scheduled") as Booking["bookingStatus"];
  const servicePrice = Number(raw.servicePrice ?? 0);
  const createdAt = Number(raw.createdAt ?? Date.now());
  const updatedAt = Number(raw.updatedAt ?? createdAt);

  if (!raw.id || !raw.customerId || !raw.serviceId || !bookingDate) return null;

  return {
    id: String(raw.id),
    customerId: String(raw.customerId),
    serviceId: String(raw.serviceId),
    bookingDate,
    startTime: String(raw.startTime ?? ""),
    endTime: String(raw.endTime ?? ""),
    location: String(raw.location ?? ""),
    servicePrice: Number.isFinite(servicePrice) ? servicePrice : 0,
    bookingStatus:
      bookingStatus === "Completed" || bookingStatus === "Cancelled"
        ? bookingStatus
        : "Scheduled",
    fullPaymentDueDate: String(raw.fullPaymentDueDate ?? bookingDate),
    notes: String(raw.notes ?? ""),
    createdAt,
    updatedAt,
  };
}

export const localStorageRepository = {
  getAll(): Booking[] {
    if (typeof window === "undefined") return [];

    try {
      const raw = localStorage.getItem(BOOKING_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const normalized = parsed
        .map((item) => normalizeBooking(item))
        .filter((item): item is Booking => item !== null);
      return normalized;
    } catch (_error) {
      return [];
    }
  },


  save(bookings: Booking[]): void {
    if (typeof window === "undefined") return;
    try {
      const raw = JSON.stringify(bookings);
      localStorage.setItem(BOOKING_STORAGE_KEY, raw);
    } catch (_error) {
      // noop
    }
  },

  create(booking: Booking): void {
    const existing = this.getAll();
    this.save([...existing, booking]);
  },

  update(booking: Booking): void {
    const existing = this.getAll();
    this.save(existing.map((b) => (b.id === booking.id ? booking : b)));
  },

  delete(id: string): void {
    const existing = this.getAll();
    this.save(existing.filter((b) => b.id !== id));
  },
};
