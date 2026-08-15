import type { Booking } from "@/features/booking/types";
import type { Expense } from "@/features/expense/types";
import type { Payment } from "@/features/payment/types";

export function bookingAdditionalChargesTotal(booking: Pick<Booking, "additionalCharges">): number {
  return (booking.additionalCharges ?? []).reduce((sum, charge) => sum + charge.amount, 0);
}

export function bookingClientTotal(booking: Pick<Booking, "servicePrice" | "additionalCharges">): number {
  return booking.servicePrice + bookingAdditionalChargesTotal(booking);
}

export function calculateBookingFinancials(
  booking: Pick<Booking, "id" | "servicePrice" | "additionalCharges" | "bookingStatus">,
  payments: readonly Payment[],
  expenses: readonly Expense[],
) {
  const totalPaid = payments.filter((payment) => payment.bookingId === booking.id).reduce((sum, payment) => sum + payment.amount, 0);
  const directExpenses = expenses.filter((expense) => expense.bookingId === booking.id).reduce((sum, expense) => sum + expense.amount, 0);
  const clientTotal = bookingClientTotal(booking);
  const cancelled = booking.bookingStatus === "Cancelled";
  return {
    servicePrice: booking.servicePrice,
    additionalCharges: bookingAdditionalChargesTotal(booking),
    clientTotal,
    totalPaid,
    directExpenses,
    outstanding: cancelled ? null : Math.max(clientTotal - totalPaid, 0),
    estimatedJobProfit: cancelled ? null : clientTotal - directExpenses,
    cashPosition: cancelled ? null : totalPaid - directExpenses,
  };
}
