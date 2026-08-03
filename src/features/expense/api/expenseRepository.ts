import { Expense } from "../types";
import { localStorageRepository } from "./localStorageRepository";

export interface ExpenseRepository {
  getAll(): Expense[];
  save(expenses: Expense[]): void;
  create(expense: Expense): void;
  update(expense: Expense): void;
  delete(id: string): void;
}

export const expenseRepository: ExpenseRepository = {
  getAll() {
    return localStorageRepository.getAll();
  },

  save(expenses: Expense[]) {
    localStorageRepository.save(expenses);
  },

  create(expense: Expense) {
    const existing = localStorageRepository.getAll();
    localStorageRepository.save([...existing, expense]);
  },

  update(expense: Expense) {
    const existing = localStorageRepository.getAll();
    localStorageRepository.save(existing.map((e) => (e.id === expense.id ? expense : e)));
  },

  delete(id: string) {
    const existing = localStorageRepository.getAll();
    localStorageRepository.save(existing.filter((e) => e.id !== id));
  },
};
