"use client";

import { useCallback, useEffect, useState } from "react";
import { Expense, CreateExpenseInput, UpdateExpenseInput } from "../types";
import { expenseRepository } from "../api/expenseRepository";
import { emitDataRefresh, subscribeToDataRefresh } from "@/lib/dataRefresh";

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const retry = useCallback(() => {
    setIsLoading(true);
    try {
      setExpenses(expenseRepository.getAll());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(retry, 0);
    const unsubscribe = subscribeToDataRefresh(retry);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [retry]);

  const createExpense = useCallback((input: CreateExpenseInput): boolean => {
    const now = Date.now();
    const expense: Expense = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...input,
    };

    try {
      expenseRepository.create(expense);
      setExpenses((prev) => [...prev, expense]);
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateExpense = useCallback((input: UpdateExpenseInput): boolean => {
    const current = expenses.find((expense) => expense.id === input.id);
    if (!current) return false;
    const updated: Expense = { ...current, ...input, updatedAt: Date.now() };

    try {
      expenseRepository.update(updated);
      setExpenses((prev) =>
        prev.map((expense) => (expense.id === updated.id ? updated : expense)),
      );
      emitDataRefresh();
      return true;
    } catch {
      return false;
    }
  }, [expenses]);

  const deleteExpense = useCallback((id: string): boolean => {
    try {
      expenseRepository.delete(id);
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
