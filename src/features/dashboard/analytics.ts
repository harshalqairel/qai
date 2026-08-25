export type AnalyticsCategory = {
  id: string;
  name: string;
  amount: number;
  color?: string;
};

import { categoryColorCss } from "@/features/category/constants";

export type DisplayAnalyticsCategory = AnalyticsCategory & { percentage: number };

export type ComparableChange = { state: "change"; percentage: number; direction: "up" | "down" | "flat" } | { state: "new" } | { state: "neutral" };

export function comparableChange(current: number, previous: number): ComparableChange {
  if (previous === 0) return current === 0 ? { state: "neutral" } : { state: "new" };
  const percentage = ((current - previous) / Math.abs(previous)) * 100;
  return { state: "change", percentage, direction: percentage > 0 ? "up" : percentage < 0 ? "down" : "flat" };
}

export function changeTone(change: ComparableChange, metric: "revenue" | "expenses" | "profit"): "positive" | "negative" | "neutral" {
  if (change.state !== "change" || change.direction === "flat") return "neutral";
  const favorable = metric === "expenses" ? change.direction === "down" : change.direction === "up";
  return favorable ? "positive" : "negative";
}

export function groupAnalyticsCategories(
  categories: AnalyticsCategory[],
  maximumVisible = 5,
): DisplayAnalyticsCategory[] {
  const sorted = categories.filter((item) => item.amount > 0).sort((a, b) => b.amount - a.amount);
  const total = sorted.reduce((sum, item) => sum + item.amount, 0);
  if (total === 0) return [];
  const visible = sorted.length > maximumVisible
    ? [
        ...sorted.slice(0, maximumVisible - 1),
        {
          id: "other",
          name: "Other",
          amount: sorted.slice(maximumVisible - 1).reduce((sum, item) => sum + item.amount, 0),
          color: "var(--category-other)",
        },
      ]
    : sorted;
  return visible.map((item) => ({ ...item, percentage: Math.round((item.amount / total) * 100) }));
}

export function donutGradient(categories: DisplayAnalyticsCategory[], fallback: string): string {
  if (categories.length === 0) return fallback;
  let cursor = 0;
  return `conic-gradient(${categories.map((item) => {
    const start = cursor;
    cursor += (item.amount / categories.reduce((sum, category) => sum + category.amount, 0)) * 100;
    const color = item.id === "other" ? "var(--category-other)" : categoryColorCss(item.color, item.id);
    return `${color ?? fallback} ${start}% ${cursor}%`;
  }).join(", ")})`;
}
