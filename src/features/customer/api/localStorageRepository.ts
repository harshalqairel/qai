import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { CUSTOMER_STORAGE_KEY } from "../constants";
import { customerRecordSchema } from "../schema";
import { Customer } from "../types";

function migrateLegacyCustomers(records: unknown[]): unknown[] {
  const migratedAt = Date.now();
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const customer = record as Record<string, unknown>;
    return {
      ...customer,
      instagram: customer.instagram ?? "",
      email: customer.email ?? "",
      notes: customer.notes ?? "",
      createdAt: customer.createdAt ?? migratedAt,
    };
  });
}

export const localStorageRepository = {
  getAll(): Customer[] {
    return readVersionedCollection(CUSTOMER_STORAGE_KEY, customerRecordSchema, {
      migrateLegacy: migrateLegacyCustomers,
    });
  },

  save(customers: Customer[]): void {
    writeVersionedCollection(CUSTOMER_STORAGE_KEY, customerRecordSchema, customers);
  },
};
