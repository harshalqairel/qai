"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryInput } from "@/features/category/types";
import { normalizeCategoryName } from "@/features/category/utils";
import type { ServiceCategory } from "../types";
import { serviceCategoryRepository } from "../api/serviceCategoryRepository";
import { serviceRepository } from "@/features/service/api/serviceRepository";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import {
  cloudServiceCategoryRepository,
  cloudServiceRepository,
} from "@/lib/supabase/cloudRepositories";

function assertUnique(
  categories: readonly ServiceCategory[],
  name: string,
  ignoredId?: string,
) {
  const normalized = normalizeCategoryName(name);
  if (categories.some((item) => item.id !== ignoredId && normalizeCategoryName(item.name) === normalized)) {
    throw new Error("DUPLICATE_CATEGORY");
  }
}

export function useServiceCategories() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [services, loadedCategories] = isCloudModeEnabled()
        ? await Promise.all([
            cloudServiceRepository.getAll(),
            cloudServiceCategoryRepository.getAll(),
          ])
        : [serviceRepository.getAll(), serviceCategoryRepository.getAll()];
      const counts: Record<string, number> = {};
      for (const service of services) {
        counts[service.categoryId] = (counts[service.categoryId] ?? 0) + 1;
      }
      setCategories(loadedCategories);
      setUsageCounts(counts);
      setLoadError("");
    } catch {
      setLoadError("Could not load categories. Try reloading the page.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    setIsLoading(true);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const runRefresh = () => { void refresh(); };
    const timeoutId = window.setTimeout(runRefresh, 0);
    const unsubscribe = subscribeToDataRefresh(runRefresh);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [refresh]);

  const createCategoryAndReturn = useCallback(async (input: CategoryInput): Promise<ServiceCategory> => {
    const current = isCloudModeEnabled()
      ? categories
      : serviceCategoryRepository.getAll();
    assertUnique(current, input.name);
    let created: ServiceCategory;
    if (isCloudModeEnabled()) {
      const now = new Date().toISOString();
      created = {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        color: input.color,
        active: true,
        createdAt: now,
        updatedAt: now,
      };
      await cloudServiceCategoryRepository.create(created);
    } else {
      created = serviceCategoryRepository.create({ ...input, name: input.name.trim() });
    }
    await refresh();
    return created;
  }, [categories, refresh]);

  const createCategory = useCallback(async (input: CategoryInput) => {
    await createCategoryAndReturn(input);
  }, [createCategoryAndReturn]);

  const updateCategory = useCallback(async (id: string, input: CategoryInput) => {
    const current = isCloudModeEnabled()
      ? categories
      : serviceCategoryRepository.getAll();
    assertUnique(current, input.name, id);
    const category = current.find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    const updated = {
      ...category,
      name: input.name.trim(),
      color: input.color,
      updatedAt: new Date().toISOString(),
    };
    if (isCloudModeEnabled()) await cloudServiceCategoryRepository.update(updated);
    else serviceCategoryRepository.update(updated);
    await refresh();
  }, [categories, refresh]);

  const setCategoryActive = useCallback(async (id: string, active: boolean) => {
    const current = isCloudModeEnabled()
      ? categories
      : serviceCategoryRepository.getAll();
    const category = current.find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    const updated = {
      ...category,
      active,
      updatedAt: new Date().toISOString(),
    };
    if (isCloudModeEnabled()) await cloudServiceCategoryRepository.update(updated);
    else serviceCategoryRepository.update(updated);
    await refresh();
  }, [categories, refresh]);

  const deleteCategory = useCallback(async (id: string, replacementId?: string) => {
    const [categoriesNow, services] = isCloudModeEnabled()
      ? [categories, await cloudServiceRepository.getAll()]
      : [serviceCategoryRepository.getAll(), serviceRepository.getAll()];
    const affected = services.filter((service) => service.categoryId === id);

    if (affected.length > 0) {
      const replacement = categoriesNow.find(
        (category) => category.id === replacementId && category.id !== id && category.active,
      );
      if (!replacement) throw new Error("INVALID_REPLACEMENT");
      const moved = services.map((service) =>
        service.categoryId === id
          ? { ...service, categoryId: replacement.id }
          : service,
      );
      if (isCloudModeEnabled()) await cloudServiceRepository.save(moved);
      else serviceRepository.save(moved);
    }

    if (isCloudModeEnabled()) await cloudServiceCategoryRepository.delete(id);
    else serviceCategoryRepository.delete(id);
    await refresh();
  }, [categories, refresh]);

  return {
    categories,
    usageCounts,
    createCategory,
    createCategoryAndReturn,
    updateCategory,
    setCategoryActive,
    deleteCategory,
    loadError,
    isLoading,
    retry,
  };
}
