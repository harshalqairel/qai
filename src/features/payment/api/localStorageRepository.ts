import { Payment } from "../types";
import { PAYMENT_STORAGE_KEY } from "../constants";

export const localStorageRepository = {
  getAll(): Payment[] {
    if (typeof window === "undefined") return [];

    try {
      const raw = localStorage.getItem(PAYMENT_STORAGE_KEY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: String(item.id ?? ""),
          bookingId: String(item.bookingId ?? ""),
          date: String(item.date ?? ""),
          amount: Number(item.amount ?? 0),
          method: String(item.method ?? "Other") as Payment["method"],
          notes: String(item.notes ?? ""),
          createdAt: Number(item.createdAt ?? Date.now()),
        }))
        .filter((item) => item.id !== "" && item.bookingId !== "" && item.date !== "");
    } catch (_error) {
      return [];
    }
  },

  save(payments: Payment[]): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(payments));
    } catch (_error) {
      // noop
    }
  },
};
