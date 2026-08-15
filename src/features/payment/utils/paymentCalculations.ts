import { Booking } from "@/features/booking/types";
import { DerivedPaymentStatus, Payment } from "../types";
import { bookingClientTotal } from "@/features/booking/domain/bookingFinancials";

export type BookingPaymentSummary = {
  bookingId: string;
  totalPaid: number;
  remainingAmount: number;
  paymentStatus: DerivedPaymentStatus;
};

export function sumPaymentsForBooking(bookingId: string, payments: Payment[]): number {
  return payments
    .filter((payment) => payment.bookingId === bookingId)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

export function derivePaymentStatus(
  bookingStatus: Booking["bookingStatus"],
  totalPaid: number,
  servicePrice: number,
): DerivedPaymentStatus {
  if (bookingStatus === "Cancelled") return "Cancelled";
  if (totalPaid <= 0) return "Outstanding";
  if (totalPaid < servicePrice) return "Partial Paid";
  return "Fully Paid";
}

/**
 * Returns a human-readable label for a payment based on its position in the
 * sorted payment history for the booking.
 * - First payment → "Down Payment"
 * - Any payment that brings the cumulative total to or above servicePrice → "Full Payment"
 * - All others → "Additional Payment"
 */
export function getPaymentLabel(
  payment: Payment,
  allBookingPayments: Payment[],
  servicePrice: number,
): string {
  const sorted = [...allBookingPayments].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt,
  );

  if (sorted.length === 0) return "Payment";

  const idx = sorted.findIndex((p) => p.id === payment.id);
  if (idx === -1) return "Payment";
  if (idx === 0) return "Down Payment";

  const cumulative = sorted.slice(0, idx + 1).reduce((sum, p) => sum + p.amount, 0);
  if (servicePrice > 0 && cumulative >= servicePrice) return "Full Payment";

  return "Additional Payment";
}

export function summarizeBookingPayments(
  bookings: Booking[],
  payments: Payment[],
): Record<string, BookingPaymentSummary> {
  const byBookingId: Record<string, BookingPaymentSummary> = {};

  for (const booking of bookings) {
    const totalPaid = sumPaymentsForBooking(booking.id, payments);
    const clientTotal = bookingClientTotal(booking);
    const remainingAmount = booking.bookingStatus === "Cancelled"
      ? 0
      : Math.max(clientTotal - totalPaid, 0);
    const paymentStatus = derivePaymentStatus(booking.bookingStatus, totalPaid, clientTotal);

    byBookingId[booking.id] = {
      bookingId: booking.id,
      totalPaid,
      remainingAmount,
      paymentStatus,
    };
  }

  return byBookingId;
}

export function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}
