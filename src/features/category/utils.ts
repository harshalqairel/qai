import type { BaseCategory } from "./types";
import { DEFAULT_CATEGORY_COLOR, normalizeCategoryColor } from "./constants";

export function normalizeCategoryName(name: string): string {
  return name.trim().toLocaleLowerCase("en-US");
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createDeterministicCategory(
  scope: "service" | "expense",
  name: string,
  color: string = DEFAULT_CATEGORY_COLOR,
): BaseCategory {
  const trimmedName = name.trim();
  const now = new Date().toISOString();
  return {
    id: `${scope}-category-${stableHash(normalizeCategoryName(trimmedName))}`,
    name: trimmedName,
    color: normalizeCategoryColor(color, `${scope}:${trimmedName}`),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function findCategoryByName<T extends BaseCategory>(
  categories: readonly T[],
  name: string,
): T | undefined {
  const normalized = normalizeCategoryName(name);
  return categories.find(
    (category) => normalizeCategoryName(category.name) === normalized,
  );
}

export function uniqueCategoryNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    const normalized = normalizeCategoryName(trimmed);
    if (!trimmed || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(trimmed);
  }
  return result;
}
