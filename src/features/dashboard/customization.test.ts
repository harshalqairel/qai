import { describe, expect, it } from "vitest";

import {
  DASHBOARD_SECTION_IDS,
  DEFAULT_DASHBOARD_PREFERENCES,
  moveDashboardSection,
  normalizeDashboardPreferences,
  setDashboardSectionVisible,
} from "./customization";

describe("dashboard customization", () => {
  it("provides a complete polished default layout", () => {
    expect(DEFAULT_DASHBOARD_PREFERENCES.map((item) => item.id)).toEqual(DASHBOARD_SECTION_IDS);
    expect(DEFAULT_DASHBOARD_PREFERENCES.every((item) => item.visible)).toBe(true);
  });

  it("shows, hides, and reorders sections without changing their identity", () => {
    const hidden = setDashboardSectionVisible(DEFAULT_DASHBOARD_PREFERENCES, "income", false);
    expect(hidden.find((item) => item.id === "income")?.visible).toBe(false);
    const shown = setDashboardSectionVisible(hidden, "income", true);
    expect(shown.find((item) => item.id === "income")?.visible).toBe(true);
    const moved = moveDashboardSection(shown, "requests", -1);
    expect(moved.findIndex((item) => item.id === "requests")).toBe(shown.findIndex((item) => item.id === "requests") - 1);
    expect(new Set(moved.map((item) => item.id))).toEqual(new Set(DASHBOARD_SECTION_IDS));
  });

  it("prevents hiding every section and restores invalid saved data to default", () => {
    let value = DEFAULT_DASHBOARD_PREFERENCES.map((item, index) => ({ ...item, visible: index === 0 }));
    value = setDashboardSectionVisible(value, value[0].id, false);
    expect(value.filter((item) => item.visible)).toHaveLength(1);
    expect(normalizeDashboardPreferences([])).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
    expect(normalizeDashboardPreferences(DEFAULT_DASHBOARD_PREFERENCES.map((item) => ({ ...item, visible: false })))).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
  });
});
