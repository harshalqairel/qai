import { describe, expect, it } from "vitest";
import { findCategoryByName, normalizeCategoryName, uniqueCategoryNames } from "./utils";
import { categoryColorCss, normalizeCategoryColor, suggestCategoryColor } from "./constants";

describe("category name integrity", () => {
  it("treats case and surrounding whitespace as equivalent", () => {
    expect(normalizeCategoryName(" Wedding ")).toBe("wedding");
    const categories = [{ id: "1", name: "Wedding", color: "#000000", active: true, createdAt: "", updatedAt: "" }];
    expect(findCategoryByName(categories, "wedding")?.id).toBe("1");
    expect(findCategoryByName(categories, " Wedding ")?.id).toBe("1");
    expect(uniqueCategoryNames(["Wedding", "wedding", " Wedding "])).toEqual(["Wedding"]);
    expect(uniqueCategoryNames([
      "Transportation",
      "transportation",
      " Transportation ",
      "TRANSPORTATION",
    ])).toEqual(["Transportation"]);
  });
});

describe("category color identity", () => {
  it("maps legacy colors and missing values to stable keys", () => {
    expect(normalizeCategoryColor("#1F6F78", "wedding")).toBe("category-teal");
    expect(normalizeCategoryColor(undefined, "service:wedding")).toBe(normalizeCategoryColor(undefined, "service:wedding"));
    expect(categoryColorCss("category-mauve")).toBe("var(--category-mauve)");
  });

  it("suggests a least-used color without randomizing", () => {
    expect(suggestCategoryColor(["category-slate", "category-blue"])).toBe("category-sky");
    expect(suggestCategoryColor(["category-slate", "category-blue"])).toBe("category-sky");
  });
});
