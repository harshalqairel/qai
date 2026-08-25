import { describe, expect, it } from "vitest";
import { toggleSelectedId, toggleVisibleSelection } from "./selection";

describe("stable ID selection", () => {
  it("toggles booking IDs without depending on row position", () => {
    const selected = toggleSelectedId(new Set(["booking-a"]), "booking-b");
    expect([...selected].sort()).toEqual(["booking-a", "booking-b"]);
    expect([...toggleSelectedId(selected, "booking-a")]).toEqual(["booking-b"]);
  });

  it("selects and clears only the visible result IDs", () => {
    const selected = toggleVisibleSelection(new Set(["hidden-booking"]), ["visible-a", "visible-b"]);
    expect([...selected].sort()).toEqual(["hidden-booking", "visible-a", "visible-b"]);
    expect([...toggleVisibleSelection(selected, ["visible-a", "visible-b"])]).toEqual(["hidden-booking"]);
  });
});
