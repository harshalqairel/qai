import { Service } from "../types";

const STORAGE_KEY = "qai:services";

export const localStorageRepository = {
  getAll(): Service[] {
    // Prevent access during SSR
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed as Service[];
    } catch (error) {
      // On parse error or any other issue, return empty array per requirements.
      console.error("Failed to read services from localStorage:", error);
      return [];
    }
  },

  save(services: Service[]): void {
    // Prevent writes during SSR
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = JSON.stringify(services);
      localStorage.setItem(STORAGE_KEY, raw);
    } catch (error) {
      // Per requirements: log the error, keep in-memory state updated, do not throw.
      console.error("Failed to save services to localStorage:", error);
    }
  },
};
