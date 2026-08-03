import { Booking } from "../types";
import { localStorageRepository } from "./localStorageRepository";

export interface BookingRepository {
  getAll(): Booking[];
  save(bookings: Booking[]): void;
  create(booking: Booking): void;
  update(booking: Booking): void;
  delete(id: string): void;
}

export const bookingRepository: BookingRepository = {
  getAll() { return localStorageRepository.getAll(); },
  save(bookings: Booking[]) { return localStorageRepository.save(bookings); },
  create(booking: Booking) { const existing = localStorageRepository.getAll(); localStorageRepository.save([...existing, booking]); },
  update(booking: Booking) { const existing = localStorageRepository.getAll(); localStorageRepository.save(existing.map((b) => (b.id === booking.id ? booking : b))); },
  delete(id: string) { const existing = localStorageRepository.getAll(); localStorageRepository.save(existing.filter((b) => b.id !== id)); },
};
