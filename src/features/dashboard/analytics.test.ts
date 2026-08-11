import { describe, expect, it } from "vitest";
import { groupAnalyticsCategories } from "./analytics";
import { getOverdueAgeDays } from "./utils";

describe("dashboard category analytics", () => {
  it("sorts categories, groups the long tail, and preserves the total", () => {
    const result = groupAnalyticsCategories([
      { id: "c", name: "C", amount: 10 }, { id: "a", name: "A", amount: 60 },
      { id: "f", name: "F", amount: 5 }, { id: "b", name: "B", amount: 20 },
      { id: "e", name: "E", amount: 5 }, { id: "d", name: "D", amount: 10 },
    ]);
    expect(result.map((item) => item.name)).toEqual(["A", "B", "C", "D", "Other"]);
    expect(result.reduce((sum, item) => sum + item.amount, 0)).toBe(110);
  });

  it("returns a graceful empty result", () => {
    expect(groupAnalyticsCategories([{ id: "empty", name: "Empty", amount: 0 }])).toEqual([]);
  });
});

describe("overdue age", () => {
  it("uses inclusive date-key boundaries without timezone drift", () => {
    expect(getOverdueAgeDays("2026-08-05", "2026-08-10")).toBe(5);
    expect(getOverdueAgeDays("2026-08-10", "2026-08-10")).toBe(0);
  });
});
