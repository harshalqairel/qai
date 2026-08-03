import { Customer } from "../types";
import { CUSTOMER_STORAGE_KEY } from "../constants";

export const localStorageRepository = {
  getAll(): Customer[] {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        // If stored value is not an array, treat as empty to avoid crashes.
        return [];
      }

      return parsed as Customer[];
    } catch (error) {
      // On parse error or any other issue, return empty array per requirements.
      return [];
    }
  },


  // Keep a save method for backward compatibility but prefer using create/update/delete
  save(customers: Customer[]): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = JSON.stringify(customers);
      localStorage.setItem(CUSTOMER_STORAGE_KEY, raw);
    } catch (_error) {
      // noop in production flow; repository should not throw.
    }
  },

  create(customer: Customer): void {
    if (typeof window === "undefined") return;
    try {
      const existing = this.getAll();
      const next = [...existing, customer];
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(next));
    } catch (_error) {
      // noop
    }
  },

  update(customer: Customer): void {
    if (typeof window === "undefined") return;
    try {
      const existing = this.getAll();
      const next = existing.map((c) => (c.id === customer.id ? customer : c));
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(next));
    } catch (_error) {
      // noop
    }
  },

  delete(id: string): void {
    if (typeof window === "undefined") return;
    try {
      const existing = this.getAll();
      const next = existing.filter((c) => c.id !== id);
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(next));
    } catch (_error) {
      // noop
    }
  },
};
