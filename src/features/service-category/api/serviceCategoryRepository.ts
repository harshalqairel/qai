import {
  readCollectionSnapshot,
  readVersionedCollection,
  writeVersionedCollection,
} from "@/lib/persistence";
import { categoryRecordSchema } from "@/features/category/schema";
import {
  createDeterministicCategory,
  findCategoryByName,
  normalizeCategoryName,
  uniqueCategoryNames,
} from "@/features/category/utils";
import type { CategoryInput } from "@/features/category/types";
import { CATEGORY_COLORS } from "@/features/category/constants";
import type { ServiceCategory } from "../types";
import {
  SERVICE_CATEGORY_STORAGE_KEY,
  SERVICE_STORAGE_KEY,
} from "@/features/service/constants";

function legacyNames(): string[] {
  const snapshot = readCollectionSnapshot(SERVICE_STORAGE_KEY);
  return uniqueCategoryNames(
    snapshot.records.flatMap((record) => {
      if (!record || typeof record !== "object" || Array.isArray(record)) return [];
      const name = (record as Record<string, unknown>).category;
      return typeof name === "string" ? [name] : [];
    }),
  );
}

function save(categories: ServiceCategory[]): void {
  writeVersionedCollection(
    SERVICE_CATEGORY_STORAGE_KEY,
    categoryRecordSchema,
    categories,
  );
}

function getAll(): ServiceCategory[] {
  const snapshot = readCollectionSnapshot(SERVICE_CATEGORY_STORAGE_KEY);
  if (snapshot.exists) {
    return readVersionedCollection(
      SERVICE_CATEGORY_STORAGE_KEY,
      categoryRecordSchema,
    );
  }

  const names = legacyNames();
  const categories = names.map((name, index) =>
    createDeterministicCategory(
      "service",
      name,
      CATEGORY_COLORS[index % CATEGORY_COLORS.length].value,
    ),
  );
  save(categories);
  return categories;
}

function ensureNames(names: readonly string[]): ServiceCategory[] {
  const categories = getAll();
  const additions = uniqueCategoryNames(names)
    .filter((name) => !findCategoryByName(categories, name))
    .map((name, index) =>
      createDeterministicCategory(
        "service",
        name,
        CATEGORY_COLORS[(categories.length + index) % CATEGORY_COLORS.length].value,
      ),
    );
  if (additions.length === 0) return categories;
  const next = [...categories, ...additions];
  save(next);
  return next;
}

export const serviceCategoryRepository = {
  getAll,
  ensureNames,
  save,
  create(input: CategoryInput): ServiceCategory {
    const categories = getAll();
    if (findCategoryByName(categories, input.name)) {
      throw new Error("DUPLICATE_CATEGORY");
    }
    const category = {
      ...createDeterministicCategory("service", input.name, input.color),
      id: crypto.randomUUID(),
    };
    save([...categories, category]);
    return category;
  },
  update(category: ServiceCategory): void {
    const categories = getAll();
    if (categories.some(
      (item) =>
        item.id !== category.id &&
        normalizeCategoryName(item.name) === normalizeCategoryName(category.name),
    )) {
      throw new Error("DUPLICATE_CATEGORY");
    }
    save(categories.map((item) => (item.id === category.id ? category : item)));
  },
  delete(id: string): void {
    save(getAll().filter((category) => category.id !== id));
  },
};
