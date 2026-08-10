"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryInput } from "@/features/category/types";
import { normalizeCategoryName } from "@/features/category/utils";
import type { ExpenseCategory } from "../types";
import { expenseCategoryRepository } from "../api/expenseCategoryRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import {
  cloudExpenseCategoryRepository,
  cloudExpenseRepository,
} from "@/lib/supabase/cloudRepositories";

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
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [expenses, loadedCategories] = isCloudModeEnabled()
        ? await Promise.all([
            cloudExpenseRepository.getAll(),
            cloudExpenseCategoryRepository.getAll(),
          ])
        : [expenseRepository.getAll(), expenseCategoryRepository.getAll()];
      const counts: Record<string, number> = {};
      for (const expense of expenses) {
        counts[expense.categoryId] = (counts[expense.categoryId] ?? 0) + 1;
      }
      setCategories(loadedCategories);
      setUsageCounts(counts);
      setLoadError("");
    } catch {
      setLoadError("Could not load categories. Try reloading the page.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const runRefresh = () => { void refresh(); };
    const timeoutId = window.setTimeout(runRefresh, 0);
    const unsubscribe = subscribeToDataRefresh(runRefresh);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [refresh]);

  const createCategory = useCallback(async (input: CategoryInput) => {
    const current = isCloudModeEnabled()
      ? categories
      : expenseCategoryRepository.getAll();
    assertUnique(current, input.name);
    if (isCloudModeEnabled()) {
      const now = new Date().toISOString();
      await cloudExpenseCategoryRepository.create({
        id: crypto.randomUUID(),
        name: input.name.trim(),
        color: input.color,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      expenseCategoryRepository.create({ ...input, name: input.name.trim() });
    }
    await refresh();
  }, [categories, refresh]);

  const updateCategory = useCallback(async (id: string, input: CategoryInput) => {
    const current = isCloudModeEnabled()
      ? categories
      : expenseCategoryRepository.getAll();
    assertUnique(current, input.name, id);
    const category = current.find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    const updated = {
      ...category,
      name: input.name.trim(),
      color: input.color,
      updatedAt: new Date().toISOString(),
    };
    if (isCloudModeEnabled()) await cloudExpenseCategoryRepository.update(updated);
    else expenseCategoryRepository.update(updated);
    await refresh();
  }, [categories, refresh]);

  const setCategoryActive = useCallback(async (id: string, active: boolean) => {
    const current = isCloudModeEnabled()
      ? categories
      : expenseCategoryRepository.getAll();
    const category = current.find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    const updated = {
      ...category,
      active,
      updatedAt: new Date().toISOString(),
    };
    if (isCloudModeEnabled()) await cloudExpenseCategoryRepository.update(updated);
    else expenseCategoryRepository.update(updated);
    await refresh();
  }, [categories, refresh]);

  const deleteCategory = useCallback(async (id: string, replacementId?: string) => {
    const [categoriesNow, expenses] = isCloudModeEnabled()
      ? [categories, await cloudExpenseRepository.getAll()]
      : [expenseCategoryRepository.getAll(), expenseRepository.getAll()];
    const affected = expenses.filter((expense) => expense.categoryId === id);

    if (affected.length > 0) {
      const replacement = categoriesNow.find(
        (category) => category.id === replacementId && category.id !== id && category.active,
      );
      if (!replacement) throw new Error("INVALID_REPLACEMENT");
      const moved = expenses.map((expense) =>
        expense.categoryId === id
          ? { ...expense, categoryId: replacement.id, updatedAt: Date.now() }
          : expense,
      );
      if (isCloudModeEnabled()) await cloudExpenseRepository.save(moved);
      else expenseRepository.save(moved);
    }

    if (isCloudModeEnabled()) await cloudExpenseCategoryRepository.delete(id);
    else expenseCategoryRepository.delete(id);
    await refresh();
  }, [categories, refresh]);

  return {
    categories,
    usageCounts,
    createCategory,
    updateCategory,
    setCategoryActive,
    deleteCategory,
    loadError,
    isLoading,
    retry,
  };
}
