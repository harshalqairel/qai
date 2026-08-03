"use client";

import { useCallback, useEffect, useState } from "react";
import { Expense, CreateExpenseInput, UpdateExpenseInput } from "../types";
import { expenseRepository } from "../api/expenseRepository";

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    try {
      setExpenses(expenseRepository.getAll());
    } catch (_error) {
      setExpenses([]);
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

    setExpenses((prev) => {
      const next = [...prev, expense];
      try {
        expenseRepository.save(next);
      } catch (_error) {
        // noop
      }
      return next;
    });

    return expense;
  }, []);

  const updateExpense = useCallback((input: UpdateExpenseInput): void => {
    setExpenses((prev) => {
      const next = prev.map((e) =>
        e.id === input.id ? { ...e, ...input, updatedAt: Date.now() } : e,
      );
      try {
        expenseRepository.save(next);
      } catch (_error) {
        // noop
      }
      return next;
    });
  }, []);

  const deleteExpense = useCallback((id: string): void => {
    setExpenses((prev) => {
      const next = prev.filter((e) => e.id !== id);
      try {
        expenseRepository.save(next);
      } catch (_error) {
        // noop
      }
      return next;
    });
  }, []);

  return { expenses, createExpense, updateExpense, deleteExpense };
}
