export const CATEGORY_COLORS = [
  { value: "category-slate", label: "Slate" },
  { value: "category-blue", label: "Blue" },
  { value: "category-sky", label: "Sky" },
  { value: "category-teal", label: "Teal" },
  { value: "category-mint", label: "Mint" },
  { value: "category-sage", label: "Sage" },
  { value: "category-amber", label: "Amber" },
  { value: "category-orange", label: "Orange" },
  { value: "category-coral", label: "Coral" },
  { value: "category-rose", label: "Rose" },
  { value: "category-mauve", label: "Mauve" },
  { value: "category-plum", label: "Plum" },
] as const;

export const DEFAULT_CATEGORY_COLOR = CATEGORY_COLORS[0].value;

export type CategoryColorKey = (typeof CATEGORY_COLORS)[number]["value"];

export const CATEGORY_COLOR_KEYS = CATEGORY_COLORS.map((color) => color.value);

const LEGACY_COLOR_KEYS: Record<string, CategoryColorKey> = {
  "#1f6f78": "category-teal",
  "#4d6b8a": "category-blue",
  "#287a58": "category-sage",
  "#b7791f": "category-amber",
  "#b74848": "category-coral",
  "#6b5b8a": "category-plum",
  "#7a6652": "category-orange",
  "#66717d": "category-slate",
  "#0d5c5a": "category-teal",
};

export function isCategoryColorKey(value: string): value is CategoryColorKey {
  return CATEGORY_COLOR_KEYS.includes(value as CategoryColorKey);
}

function stableColorIndex(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % CATEGORY_COLORS.length;
}

export function normalizeCategoryColor(value: string | null | undefined, stableIdentity = ""): CategoryColorKey {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (isCategoryColorKey(normalized)) return normalized;
  if (LEGACY_COLOR_KEYS[normalized]) return LEGACY_COLOR_KEYS[normalized];
  return CATEGORY_COLORS[stableColorIndex(stableIdentity.trim().toLowerCase())].value;
}

export function categoryColorCss(value: string | null | undefined, stableIdentity = ""): string {
  return `var(--${normalizeCategoryColor(value, stableIdentity)})`;
}

export function suggestCategoryColor(existingColors: readonly string[]): CategoryColorKey {
  const counts = new Map<CategoryColorKey, number>(CATEGORY_COLOR_KEYS.map((key) => [key, 0]));
  for (const color of existingColors) {
    const key = normalizeCategoryColor(color);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return CATEGORY_COLOR_KEYS.reduce((best, key) =>
    (counts.get(key) ?? 0) < (counts.get(best) ?? 0) ? key : best,
  CATEGORY_COLOR_KEYS[0]);
}
