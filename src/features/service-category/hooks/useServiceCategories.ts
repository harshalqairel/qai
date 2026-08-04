"use client";

import { useCallback, useEffect, useState } from "react";
import type { CategoryInput } from "@/features/category/types";
import { normalizeCategoryName } from "@/features/category/utils";
import type { ServiceCategory } from "../types";
import { serviceCategoryRepository } from "../api/serviceCategoryRepository";
import { serviceRepository } from "@/features/service/api/serviceRepository";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";

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

  const refresh = useCallback(() => {
    try {
      const services = serviceRepository.getAll();
      const loadedCategories = serviceCategoryRepository.getAll();
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
    refresh();
  }, [refresh]);

  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeToDataRefresh(refresh);
    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [refresh]);

  const createCategory = useCallback((input: CategoryInput) => {
    const current = serviceCategoryRepository.getAll();
    assertUnique(current, input.name);
    serviceCategoryRepository.create({ ...input, name: input.name.trim() });
    refresh();
  }, [refresh]);

  const updateCategory = useCallback((id: string, input: CategoryInput) => {
    const current = serviceCategoryRepository.getAll();
    assertUnique(current, input.name, id);
    const category = current.find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    serviceCategoryRepository.update({
      ...category,
      name: input.name.trim(),
      color: input.color,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  }, [refresh]);

  const setCategoryActive = useCallback((id: string, active: boolean) => {
    const category = serviceCategoryRepository.getAll().find((item) => item.id === id);
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    serviceCategoryRepository.update({
      ...category,
      active,
      updatedAt: new Date().toISOString(),
    });
    refresh();
  }, [refresh]);

  const deleteCategory = useCallback((id: string, replacementId?: string) => {
    const categoriesNow = serviceCategoryRepository.getAll();
    const services = serviceRepository.getAll();
    const affected = services.filter((service) => service.categoryId === id);

    if (affected.length > 0) {
      const replacement = categoriesNow.find(
        (category) => category.id === replacementId && category.id !== id && category.active,
      );
      if (!replacement) throw new Error("INVALID_REPLACEMENT");
      serviceRepository.save(
        services.map((service) =>
          service.categoryId === id
            ? { ...service, categoryId: replacement.id }
            : service,
        ),
      );
    }

    serviceCategoryRepository.delete(id);
    refresh();
  }, [refresh]);

  return {
    categories,
    usageCounts,
    createCategory,
    updateCategory,
    setCategoryActive,
    deleteCategory,
    loadError,
    isLoading,
    retry,
  };
}
