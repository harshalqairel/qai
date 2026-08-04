import {
  readCollectionSnapshot,
  readVersionedCollection,
  writeVersionedCollection,
} from "@/lib/persistence";
import {
  EXPENSE_STORAGE_KEY,
  EXPENSE_STORAGE_VERSION,
} from "../constants";
import { expenseRecordSchema } from "../schema";
import { Expense } from "../types";
import { expenseCategoryRepository } from "@/features/expense-category/api/expenseCategoryRepository";
import { findCategoryByName } from "@/features/category/utils";
import type { ExpenseCategory } from "@/features/expense-category/types";

function legacyCategoryNames(records: unknown[]): string[] {
  return records.flatMap((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    const category = (record as Record<string, unknown>).category;
    return [typeof category === "string" && category.trim() ? category : "Other"];
  });
}

function migrateExpenses(
  records: unknown[],
  categories: readonly ExpenseCategory[],
): unknown[] {
  const migratedAt = Date.now();
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const expense = record as Record<string, unknown>;
    const createdAt = expense.createdAt ?? migratedAt;

    let categoryId = expense.categoryId;
    if (typeof categoryId !== "string" || !categoryId.trim()) {
      const legacyName =
        typeof expense.category === "string" && expense.category.trim()
          ? expense.category
          : "Other";
      const category = findCategoryByName(categories, legacyName);
      if (!category) throw new Error("Expense category migration failed.");
      categoryId = category.id;
    }

    const { category: legacyCategory, ...rest } = expense;
    void legacyCategory;
    return {
      ...rest,
      categoryId,
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
    const snapshot = readCollectionSnapshot(EXPENSE_STORAGE_KEY);
    const categories = expenseCategoryRepository.ensureNames(
      legacyCategoryNames(snapshot.records),
    );
    const migrate = (records: unknown[]) => migrateExpenses(records, categories);

    return readVersionedCollection(EXPENSE_STORAGE_KEY, expenseRecordSchema, {
      version: EXPENSE_STORAGE_VERSION,
      migrateLegacy: migrate,
      migrateVersioned: migrate,
    });
  },

  save(expenses: Expense[]): void {
    writeVersionedCollection(EXPENSE_STORAGE_KEY, expenseRecordSchema, expenses, {
      version: EXPENSE_STORAGE_VERSION,
    });
  },
};
