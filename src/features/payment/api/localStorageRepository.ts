import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { PAYMENT_STORAGE_KEY } from "../constants";
import { paymentRecordSchema } from "../schema";
import { Payment } from "../types";

function migrateLegacyPayments(records: unknown[]): unknown[] {
  const migratedAt = Date.now();
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const payment = record as Record<string, unknown>;
    return {
      ...payment,
      method: payment.method ?? "Other",
      notes: payment.notes ?? "",
      createdAt: payment.createdAt ?? migratedAt,
    };
  });
}

export const localStorageRepository = {
  getAll(): Payment[] {
    return readVersionedCollection(PAYMENT_STORAGE_KEY, paymentRecordSchema, {
      migrateLegacy: migrateLegacyPayments,
    });
  },

  save(payments: Payment[]): void {
    writeVersionedCollection(PAYMENT_STORAGE_KEY, paymentRecordSchema, payments);
  },
};
