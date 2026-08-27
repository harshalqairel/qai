import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("Qai Space route compatibility", () => {
  it("publishes /space as an owner route", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/space/page.tsx"))).toBe(true);
  });

  it("permanently redirects the legacy owner route", async () => {
    expect(nextConfig.redirects).toBeTypeOf("function");
    const redirects = await nextConfig.redirects!();
    expect(redirects).toContainEqual({
      source: "/qai-page",
      destination: "/space",
      permanent: true,
    });
    expect(redirects).toContainEqual({
      source: "/qai-page",
      has: [{ type: "query", key: "tab", value: "Page" }],
      destination: "/space?tab=Profile",
      permanent: true,
    });
  });

  it("keeps the public /q/[slug] route unchanged", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/q/[slug]/page.tsx"))).toBe(true);
  });
});
