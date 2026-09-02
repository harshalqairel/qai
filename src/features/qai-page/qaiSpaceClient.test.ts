import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { qaiSpaceClient } from "./validation";

describe("Qai Space runtime transport", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { pages: [], requests: [], capabilities: {} } }),
    })));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the cloud Qai Space API when cloud mode is enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_QAI_CLOUD_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "false");

    await qaiSpaceClient.owner();

    expect(fetch).toHaveBeenCalledWith(
      "/api/qai-space?scope=owner",
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("uses the isolated validation API only when validation mode is explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_QAI_CLOUD_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "true");

    await qaiSpaceClient.owner();

    expect(fetch).toHaveBeenCalledWith(
      "/api/validation?scope=owner",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
