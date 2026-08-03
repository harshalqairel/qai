import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { EXPENSE_STORAGE_KEY } from "../constants";
import { expenseRecordSchema } from "../schema";
import { Expense } from "../types";

function migrateLegacyExpenses(records: unknown[]): unknown[] {
  const migratedAt = Date.now();
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const expense = record as Record<string, unknown>;
    const createdAt = expense.createdAt ?? migratedAt;
    return {
      ...expense,
      category: expense.category ?? "Other",
      paymentMethod: expense.paymentMethod ?? "Cash",
      expenseType:
        expense.expenseType ??
        (expense.bookingId ? "Booking Expense" : "Business Expense"),
      bookingId: expense.bookingId ?? null,
      vendor: expense.vendor ?? "",
      notes: expense.notes ?? "",
      createdAt,
      updatedAt: expense.updatedAt ?? createdAt,
    };
  });
}

export const localStorageRepository = {
  getAll(): Expense[] {
    return readVersionedCollection(EXPENSE_STORAGE_KEY, expenseRecordSchema, {
      migrateLegacy: migrateLegacyExpenses,
    });
  },

  save(expenses: Expense[]): void {
    writeVersionedCollection(EXPENSE_STORAGE_KEY, expenseRecordSchema, expenses);
  },
};
