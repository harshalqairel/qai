import { describe, expect, it } from "vitest";

import { normalizeQaiSpaceTab, qaiSpaceHref } from "./qaiSpaceRouting";

describe("Qai Space owner routing", () => {
  it("uses Profile as the safe default", () => {
    expect(normalizeQaiSpaceTab(null)).toBe("Profile");
    expect(normalizeQaiSpaceTab("Unknown")).toBe("Profile");
  });

  it("keeps the legacy Page tab deep link working", () => {
    expect(normalizeQaiSpaceTab("Page")).toBe("Profile");
  });

  it.each(["Profile", "Design", "Portfolio", "Services", "Booking", "Requests", "Preview"] as const)(
    "preserves the %s tab",
    (tab) => expect(normalizeQaiSpaceTab(tab)).toBe(tab),
  );

  it("generates only canonical owner links", () => {
    expect(qaiSpaceHref()).toBe("/space");
    expect(qaiSpaceHref("Requests")).toBe("/space?tab=Requests");
  });
});
