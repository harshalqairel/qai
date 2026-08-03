"use client";

import { useCallback, useEffect, useState } from "react";
import { Expense, CreateExpenseInput, UpdateExpenseInput } from "../types";
import { expenseRepository } from "../api/expenseRepository";
import { EXPENSE_STORAGE_KEY } from "../constants";
import { toPersistenceError } from "@/lib/persistence";
import type { PersistenceErrorCode } from "@/lib/persistence";

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [persistenceErrorCode, setPersistenceErrorCode] =
    useState<PersistenceErrorCode | null>(null);

  useEffect(() => {
    try {
      setExpenses(expenseRepository.getAll());
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, EXPENSE_STORAGE_KEY).code);
    }
  }, []);

  const createExpense = useCallback((input: CreateExpenseInput): Expense => {
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
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, EXPENSE_STORAGE_KEY).code);
    }

    return expense;
  }, []);

  const updateExpense = useCallback((input: UpdateExpenseInput): void => {
    const current = expenses.find((expense) => expense.id === input.id);
    if (!current) return;
    const updated: Expense = { ...current, ...input, updatedAt: Date.now() };

    try {
      expenseRepository.update(updated);
      setExpenses((prev) =>
        prev.map((expense) => (expense.id === updated.id ? updated : expense)),
      );
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, EXPENSE_STORAGE_KEY).code);
    }
  }, [expenses]);

  const deleteExpense = useCallback((id: string): void => {
    try {
      expenseRepository.delete(id);
      setExpenses((prev) => prev.filter((expense) => expense.id !== id));
      setPersistenceErrorCode(null);
    } catch (error) {
      setPersistenceErrorCode(toPersistenceError(error, EXPENSE_STORAGE_KEY).code);
    }
  }, []);

  return {
    expenses,
    createExpense,
    updateExpense,
    deleteExpense,
    persistenceErrorCode,
  };
}
