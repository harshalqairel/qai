import { describe, expect, it } from "vitest";
import { normalizeSocialProfile, socialProfileUrl } from "./socialProfiles";

describe("social profile normalization", () => {
  it("normalizes usernames, @handles, and supported profile URLs", () => {
    expect(normalizeSocialProfile("tiktok", "@qai.studio")).toBe("qai.studio");
    expect(normalizeSocialProfile("tiktok", "https://www.tiktok.com/@qai_studio/video/1")).toBe("qai_studio");
    expect(socialProfileUrl("instagram", "https://instagram.com/qai.studio/")).toBe("https://www.instagram.com/qai.studio");
  });

  it("rejects unsupported hosts and malformed handles", () => {
    expect(normalizeSocialProfile("tiktok", "https://example.com/@qai")).toBeNull();
    expect(normalizeSocialProfile("tiktok", "bad handle")).toBeNull();
    expect(socialProfileUrl("tiktok", "")).toBeNull();
  });
});
