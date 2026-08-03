import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { SERVICE_STORAGE_KEY } from "../constants";
import { serviceRecordSchema } from "../schema";
import { Service } from "../types";

function migrateLegacyServices(records: unknown[]): unknown[] {
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const service = record as Record<string, unknown>;
    return {
      ...service,
      description: service.description ?? "",
      active: service.active ?? true,
    };
  });
}

export const localStorageRepository = {
  getAll(): Service[] {
    return readVersionedCollection(SERVICE_STORAGE_KEY, serviceRecordSchema, {
      migrateLegacy: migrateLegacyServices,
    });
  },

  save(services: Service[]): void {
    writeVersionedCollection(SERVICE_STORAGE_KEY, serviceRecordSchema, services);
  },
};
