import { z } from "zod";
import { normalizeCategoryName } from "@/features/category/utils";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { cloudAdditionalChargeCategoryRepository } from "@/lib/supabase/cloudRepositories";

export type AdditionalChargeCategory = { id: string; name: string; createdAt: number };
export const ADDITIONAL_CHARGE_CATEGORY_STORAGE_KEY = "qai:additional-charge-categories";
export const additionalChargeCategorySchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(80), createdAt: z.number().int().nonnegative() });
export const DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES = ["Transportation", "Parking", "Toll", "Accommodation", "Overtime", "Extra person", "Extra assistant", "Other"] as const;

export function getAdditionalChargeCategories(): AdditionalChargeCategory[] {
  const stored = readVersionedCollection(ADDITIONAL_CHARGE_CATEGORY_STORAGE_KEY, additionalChargeCategorySchema);
  if (stored.length) return stored;
  return DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES.map((name, index) => ({ id: `charge-category-${index + 1}`, name, createdAt: 0 }));
}

export function createAdditionalChargeCategory(name: string): AdditionalChargeCategory {
  const normalized = normalizeCategoryName(name);
  if (!normalized) throw new Error("CATEGORY_NAME_REQUIRED");
  const categories = getAdditionalChargeCategories();
  if (categories.some((category) => normalizeCategoryName(category.name) === normalized)) throw new Error("DUPLICATE_CATEGORY");
  const category = { id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now() };
  writeVersionedCollection(ADDITIONAL_CHARGE_CATEGORY_STORAGE_KEY, additionalChargeCategorySchema, [...categories, category]);
  return category;
}

export async function loadAdditionalChargeCategories(): Promise<AdditionalChargeCategory[]> {
  if (!isCloudModeEnabled()) return getAdditionalChargeCategories();
  const categories = await cloudAdditionalChargeCategoryRepository.getAll();
  if (categories.length) return categories;
  return cloudAdditionalChargeCategoryRepository.ensureDefaults(DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES);
}

export async function createAdditionalChargeCategoryPersistent(name: string): Promise<AdditionalChargeCategory> {
  const normalized = normalizeCategoryName(name);
  if (!normalized) throw new Error("CATEGORY_NAME_REQUIRED");
  if (!isCloudModeEnabled()) return createAdditionalChargeCategory(name);
  const categories = await cloudAdditionalChargeCategoryRepository.getAll();
  if (categories.some((category) => normalizeCategoryName(category.name) === normalized)) throw new Error("DUPLICATE_CATEGORY");
  const category = { id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now() };
  await cloudAdditionalChargeCategoryRepository.create(category);
  return category;
}
