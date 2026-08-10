"use client";

import { useCallback, useEffect, useState } from "react";
import { Expense, CreateExpenseInput, UpdateExpenseInput } from "../types";
import { expenseRepository } from "../api/expenseRepository";
import { emitDataRefresh, subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { cloudExpenseRepository } from "@/lib/supabase/cloudRepositories";

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = isCloudModeEnabled()
        ? await cloudExpenseRepository.getAll()
        : expenseRepository.getAll();
      setExpenses(loaded);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => { void retry(); };
    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeToDataRefresh(refresh);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [retry]);

  const createExpense = useCallback(async (input: CreateExpenseInput): Promise<boolean> => {
    const now = Date.now();
    const expense: Expense = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    try {
      if (isCloudModeEnabled()) await cloudExpenseRepository.create(expense);
      else expenseRepository.create(expense);
      setExpenses((prev) => [...prev, expense]);
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateExpense = useCallback(async (input: UpdateExpenseInput): Promise<boolean> => {
    const current = expenses.find((expense) => expense.id === input.id);
    if (!current) return false;
    const updated: Expense = { ...current, ...input, updatedAt: Date.now() };

    try {
      if (isCloudModeEnabled()) await cloudExpenseRepository.update(updated);
      else expenseRepository.update(updated);
      setExpenses((prev) =>
        prev.map((expense) => (expense.id === updated.id ? updated : expense)),
      );
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, [expenses]);

  const deleteExpense = useCallback(async (id: string): Promise<boolean> => {
    try {
      if (isCloudModeEnabled()) await cloudExpenseRepository.delete(id);
      else expenseRepository.delete(id);
      setExpenses((prev) => prev.filter((expense) => expense.id !== id));
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  return {
    expenses,
    createExpense,
    updateExpense,
    deleteExpense,
    isLoading,
    loadError,
    retry,
  };
}
