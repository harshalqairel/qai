export type AnalyticsCategory = {
  id: string;
  name: string;
  amount: number;
  color?: string;
};

export type DisplayAnalyticsCategory = AnalyticsCategory & { percentage: number };

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
          color: "#94a3b8",
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
    return `${item.color ?? fallback} ${start}% ${cursor}%`;
  }).join(", ")})`;
}
