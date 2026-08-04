import type { Booking } from "@/features/booking/types";
import type { Payment } from "@/features/payment/types";

export type PaymentBookingIntegrity = {
  validPayments: Payment[];
  orphanPayments: Payment[];
};

export function partitionPaymentsByBookingIntegrity(
  payments: readonly Payment[],
  bookings: readonly Booking[],
): PaymentBookingIntegrity {
  const bookingIds = new Set(bookings.map((booking) => booking.id));
  const validPayments: Payment[] = [];
  const orphanPayments: Payment[] = [];

  for (const payment of payments) {
    if (bookingIds.has(payment.bookingId)) {
      validPayments.push(payment);
      continue;
    }
    orphanPayments.push(payment);
  }

  return { validPayments, orphanPayments };
}
