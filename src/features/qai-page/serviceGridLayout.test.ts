import { describe, expect, it } from "vitest";

import { createResponsiveServiceGridPlans, createServiceGridPlan, serviceGridDesktopLimit } from "./serviceGridLayout";

describe("count-aware public Service grid", () => {
  it.each([
    [1, [1]],
    [2, [2]],
    [3, [3]],
    [4, [4]],
    [5, [3, 2]],
    [6, [3, 3]],
    [7, [4, 3]],
    [8, [4, 4]],
    [9, [3, 3, 3]],
    [10, [4, 3, 3]],
    [11, [4, 4, 3]],
    [12, [4, 4, 4]],
  ] as const)("balances %i Services without a fixed-column orphan", (count, rows) => {
    const plan = createServiceGridPlan(count, 4);
    expect(plan.rows).toEqual(rows);
    expect(plan.placements).toHaveLength(count);
    expect(plan.placements.every((placement) => Number.isInteger(placement.start) && Number.isInteger(placement.span))).toBe(true);
  });

  it("uses wider, quieter geometry for Minimal Studio and Magazine Portfolio", () => {
    expect(serviceGridDesktopLimit("Signature")).toBe(3);
    expect(serviceGridDesktopLimit("Editorial")).toBe(3);
    expect(createResponsiveServiceGridPlans(7, "Signature").desktop.rows).toEqual([3, 2, 2]);
  });

  it("collapses deterministically to two tablet columns and one mobile column", () => {
    const plans = createResponsiveServiceGridPlans(5, "Muse");
    expect(plans.tablet.rows).toEqual([2, 2, 1]);
    expect(plans.mobile.rows).toEqual([1, 1, 1, 1, 1]);
  });
});
