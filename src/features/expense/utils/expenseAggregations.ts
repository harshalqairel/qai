import { Expense } from "../types";
import type { ExpenseCategory } from "@/features/expense-category/types";

export type ExpenseCategoryItem = {
  category: string;
  amount: number;
  percentage: number;
};

/** Returns a 12-element array of monthly expense totals (index 0 = Jan). */
export function getMonthlyExpenses(expenses: Expense[], year: number): number[] {
  const monthly = Array.from({ length: 12 }, () => 0);

  for (const expense of expenses) {
    const d = new Date(`${expense.date}T00:00:00`);
    if (d.getFullYear() !== year) continue;
    monthly[d.getMonth()] += expense.amount;
  }

  return monthly;
}

/** Sum of all expenses recorded for a specific booking. */
export function getBookingExpenses(bookingId: string, expenses: Expense[]): number {
  return expenses
    .filter((e) => e.bookingId === bookingId)
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Revenue by expense category, sorted by amount descending. */
export function getExpensesByCategory(
  expenses: Expense[],
  categories: readonly ExpenseCategory[],
): ExpenseCategoryItem[] {
  const categoryMap = new Map<string, number>();
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  for (const expense of expenses) {
    const categoryName = categoryNameById.get(expense.categoryId) ?? "Category not found";
    categoryMap.set(categoryName, (categoryMap.get(categoryName) ?? 0) + expense.amount);
  }

  const total = Array.from(categoryMap.values()).reduce((sum, v) => sum + v, 0);

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
