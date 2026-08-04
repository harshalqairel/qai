import type { Booking } from "@/features/booking/types";
import type { Expense } from "@/features/expense/types";

export type ExpenseBookingIntegrity = {
  validExpenses: Expense[];
  orphanLinkedExpenses: Expense[];
};

export function partitionExpensesByBookingIntegrity(
  expenses: readonly Expense[],
  bookings: readonly Booking[],
): ExpenseBookingIntegrity {
  const bookingIds = new Set(bookings.map((booking) => booking.id));
  const validExpenses: Expense[] = [];
  const orphanLinkedExpenses: Expense[] = [];

  for (const expense of expenses) {
    if (expense.bookingId === null || bookingIds.has(expense.bookingId)) {
      validExpenses.push(expense);
      continue;
    }
    orphanLinkedExpenses.push(expense);
  }

  return { validExpenses, orphanLinkedExpenses };
}
