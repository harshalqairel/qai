import { describe, expect, it } from "vitest";
import { APPEARANCE_THEMES, DEFAULT_APPEARANCE_THEME } from "./appearance";

describe("appearance themes", () => {
  it("uses Serein by default and offers exactly the three curated themes", () => {
    expect(DEFAULT_APPEARANCE_THEME).toBe("serein");
    expect(APPEARANCE_THEMES.map((theme) => theme.id)).toEqual(["nocturne", "serein", "bloom"]);
    expect(APPEARANCE_THEMES.map((theme) => theme.name)).toEqual(["Nocturne", "Serein", "Bloom"]);
  });
});
