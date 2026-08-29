import { describe, expect, it } from "vitest";

import { DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES } from "./additionalChargeCategories";

describe("Additional Charge category defaults", () => {
  it("keeps local fallback IDs out of the cloud seeding contract", () => {
    expect(DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES).toContain("Extra assistant");
    expect(new Set(DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES).size).toBe(DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES.length);
    expect(DEFAULT_ADDITIONAL_CHARGE_CATEGORY_NAMES.some((name) => name.includes("charge-category"))).toBe(false);
  });
});
