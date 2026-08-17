import {
  readCollectionSnapshot,
  readVersionedCollection,
  writeVersionedCollection,
} from "@/lib/persistence";
import {
  SERVICE_STORAGE_KEY,
  SERVICE_STORAGE_VERSION,
} from "../constants";
import { serviceRecordSchema } from "../schema";
import { Service } from "../types";
import { serviceCategoryRepository } from "@/features/service-category/api/serviceCategoryRepository";
import { findCategoryByName } from "@/features/category/utils";
import type { ServiceCategory } from "@/features/service-category/types";

function legacyCategoryNames(records: unknown[]): string[] {
  return records.flatMap((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return [];
    const category = (record as Record<string, unknown>).category;
    return typeof category === "string" ? [category] : [];
  });
}

function migrateServices(
  records: unknown[],
  categories: readonly ServiceCategory[],
): unknown[] {
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    const service = record as Record<string, unknown>;
    if (typeof service.categoryId === "string" && service.categoryId.trim()) {
      return {
        ...service,
        description: service.description ?? "",
        defaultSessionCount: service.defaultSessionCount ?? 1,
        locationPolicy: service.locationPolicy ?? "Client can choose",
        optionGroups: service.optionGroups ?? [],
        variants: service.variants ?? [],
        active: service.active ?? true,
      };
    }

    const legacyName = typeof service.category === "string" ? service.category : "";
    const category = findCategoryByName(categories, legacyName);
    if (!category) throw new Error("Service category migration failed.");

    const { category: _legacyCategory, ...rest } = service;
    void _legacyCategory;
    return {
      ...rest,
      categoryId: category.id,
      description: service.description ?? "",
      defaultSessionCount: service.defaultSessionCount ?? 1,
      locationPolicy: service.locationPolicy ?? "Client can choose",
      optionGroups: service.optionGroups ?? [],
      variants: service.variants ?? [],
      active: service.active ?? true,
    };
  });
}

export const localStorageRepository = {
  getAll(): Service[] {
    const snapshot = readCollectionSnapshot(SERVICE_STORAGE_KEY);
    const categories = serviceCategoryRepository.ensureNames(
      legacyCategoryNames(snapshot.records),
    );
    const migrate = (records: unknown[]) => migrateServices(records, categories);

    return readVersionedCollection(SERVICE_STORAGE_KEY, serviceRecordSchema, {
      version: SERVICE_STORAGE_VERSION,
      migrateLegacy: migrate,
      migrateVersioned: migrate,
    });
  },

  save(services: Service[]): void {
    writeVersionedCollection(SERVICE_STORAGE_KEY, serviceRecordSchema, services, {
      version: SERVICE_STORAGE_VERSION,
    });
  },
};
