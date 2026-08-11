import { describe, expect, it } from "vitest";
import { findCategoryByName, normalizeCategoryName, uniqueCategoryNames } from "./utils";

describe("category name integrity", () => {
  it("treats case and surrounding whitespace as equivalent", () => {
    expect(normalizeCategoryName(" Wedding ")).toBe("wedding");
    const categories = [{ id: "1", name: "Wedding", color: "#000000", active: true, createdAt: "", updatedAt: "" }];
    expect(findCategoryByName(categories, "wedding")?.id).toBe("1");
    expect(findCategoryByName(categories, " Wedding ")?.id).toBe("1");
    expect(uniqueCategoryNames(["Wedding", "wedding", " Wedding "])).toEqual(["Wedding"]);
  });
});
