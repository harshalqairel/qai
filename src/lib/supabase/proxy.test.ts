import { describe, expect, it } from "vitest";

import { isCloudPublicRoute } from "./proxy";

describe("cloud public routes", () => {
  it.each([
    "/q/nuyimakeup",
    "/q/testtt",
    "/api/qai-space",
    "/api/qai-space/public-media",
    "/api/qai-space/media/6f7bdd95-a3d6-4a9f-b27b-f6e4de71af3f",
    "/sw.js",
  ])("keeps %s publicly reachable", (pathname) => {
    expect(isCloudPublicRoute(pathname)).toBe(true);
  });

  it.each(["/space", "/dashboard", "/api/qai-space/media"])("keeps %s behind owner authentication", (pathname) => {
    expect(isCloudPublicRoute(pathname)).toBe(false);
  });
});
