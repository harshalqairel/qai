import { Booking } from "../types";
import { localStorageRepository } from "./localStorageRepository";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";

export type BookingDeleteResult = "deleted" | "blocked";

export interface BookingRepository {
  getAll(): Booking[];
  save(bookings: Booking[]): void;
  create(booking: Booking): void;
  update(booking: Booking): void;
  delete(id: string): BookingDeleteResult;
}

export const bookingRepository: BookingRepository = {
  getAll() { return localStorageRepository.getAll(); },
  save(bookings: Booking[]) { return localStorageRepository.save(bookings); },
  create(booking: Booking) { const existing = localStorageRepository.getAll(); localStorageRepository.save([...existing, booking]); },
  update(booking: Booking) { const existing = localStorageRepository.getAll(); localStorageRepository.save(existing.map((b) => (b.id === booking.id ? booking : b))); },
  delete(id: string) {
    const hasLinkedPayment = paymentRepository.getAll().some((payment) => payment.bookingId === id);
    const hasLinkedExpense = expenseRepository.getAll().some((expense) => expense.bookingId === id);
    if (hasLinkedPayment || hasLinkedExpense) {
      return "blocked";
    }

    const existing = localStorageRepository.getAll();
    localStorageRepository.save(existing.filter((b) => b.id !== id));
    return "deleted";
  },
};
