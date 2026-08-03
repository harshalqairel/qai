import { Expense } from "../types";
import { EXPENSE_STORAGE_KEY } from "../constants";

function normalizeExpense(item: Record<string, unknown>): Expense {
  return {
    id: String(item.id ?? ""),
    date: String(item.date ?? ""),
    category: String(item.category ?? "Other") as Expense["category"],
    amount: Number(item.amount ?? 0),
    paymentMethod: String(item.paymentMethod ?? "Cash") as Expense["paymentMethod"],
    expenseType: String(item.expenseType ?? "Business Expense") as Expense["expenseType"],
    bookingId: item.bookingId ? String(item.bookingId) : null,
    vendor: String(item.vendor ?? ""),
    notes: String(item.notes ?? ""),
    createdAt: Number(item.createdAt ?? Date.now()),
    updatedAt: Number(item.updatedAt ?? Date.now()),
  };
}

export const localStorageRepository = {
  getAll(): Expense[] {
    if (typeof window === "undefined") return [];

    try {
      const raw = localStorage.getItem(EXPENSE_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => normalizeExpense(item as Record<string, unknown>))
        .filter((item) => item.id !== "" && item.date !== "");
    } catch (_error) {
      return [];
    }
  },

  save(expenses: Expense[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(EXPENSE_STORAGE_KEY, JSON.stringify(expenses));
    } catch (_error) {
      // noop — in-memory state is still updated
    }
  },
};
