"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryInput } from "@/features/category/types";
import { normalizeCategoryName } from "@/features/category/utils";
import type { ExpenseCategory } from "../types";
import { expenseCategoryRepository } from "../api/expenseCategoryRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";

function assertUnique(
  categories: readonly ExpenseCategory[],
  name: string,
  ignoredId?: string,
) {
  const normalized = normalizeCategoryName(name);
  if (categories.some((item) => item.id !== ignoredId && normalizeCategoryName(item.name) === normalized)) {
    throw new Error("DUPLICATE_CATEGORY");
  }
}

export function useExpenseCategories() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(() => {
    try {
      const expenses = expenseRepository.getAll();
      const loadedCategories = expenseCategoryRepository.getAll();
      const counts: Record<string, number> = {};
      for (const expense of expenses) {
        counts[expense.categoryId] = (counts[expense.categoryId] ?? 0) + 1;
      }
      setCategories(loadedCategories);
      setUsageCounts(counts);
      setLoadError("");
    } catch {
      setLoadError("Could not load categories. Try reloading the page.");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(timeoutId);
  }, [refresh]);

  const createCategory = useCallback((input: CategoryInput) => {
    const current = expenseCategoryRepository.getAll();
    assertUnique(current, input.name);
    expenseCategoryRepository.create({ ...input, name: input.name.trim() });
    refresh();
  }, [refresh]);

  const updateCategory = useCallback((id: string, input: CategoryInput) => {
    const current = expenseCategoryRepository.getAll();
    assertUnique(current, input.name, id);
    const category = current.find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    expenseCategoryRepository.update({
      ...category,
      name: input.name.trim(),
      color: input.color,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  }, [refresh]);

  const setCategoryActive = useCallback((id: string, active: boolean) => {
    const category = expenseCategoryRepository.getAll().find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    expenseCategoryRepository.update({
      ...category,
      active,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  }, [refresh]);

  const deleteCategory = useCallback((id: string, replacementId?: string) => {
    const categoriesNow = expenseCategoryRepository.getAll();
    const expenses = expenseRepository.getAll();
    const affected = expenses.filter((expense) => expense.categoryId === id);

    if (affected.length > 0) {
      const replacement = categoriesNow.find(
        (category) => category.id === replacementId && category.id !== id && category.active,
      );
      if (!replacement) throw new Error("INVALID_REPLACEMENT");
      expenseRepository.save(
        expenses.map((expense) =>
          expense.categoryId === id
            ? { ...expense, categoryId: replacement.id, updatedAt: Date.now() }
            : expense,
        ),
      );
    }

    expenseCategoryRepository.delete(id);
    refresh();
  }, [refresh]);

  return {
    categories,
    usageCounts,
    createCategory,
    updateCategory,
    setCategoryActive,
    deleteCategory,
    loadError,
  };
}
