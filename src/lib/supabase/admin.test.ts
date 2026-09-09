import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(() => ({ kind: "cloud-admin" })) }));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { createCloudAdminClient, logCloudFailure } from "./admin";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); mocks.createClient.mockClear(); });

function configurePublicSupabase() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
}

describe("cloud admin client", () => {
  it("creates a server-only client with SUPABASE_SECRET_KEY", () => {
    configurePublicSupabase();
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret");

    expect(createCloudAdminClient()).toEqual({ kind: "cloud-admin" });
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://project-ref.supabase.co",
      "test-server-secret",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("fails safely when SUPABASE_SECRET_KEY is missing", () => {
    configurePublicSupabase();
    vi.stubEnv("SUPABASE_SECRET_KEY", "");

    expect(() => createCloudAdminClient()).toThrow("Cloud storage is not configured.");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("does not accept the legacy service-role variable", () => {
    configurePublicSupabase();
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-server-key");

    expect(() => createCloudAdminClient()).toThrow("Cloud storage is not configured.");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("redacts the server secret from controlled diagnostics", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logCloudFailure("public read", {
      message: "request failed with test-server-secret",
      details: "test-server-secret must not be logged",
      code: "PGRST500",
    });

    const serialized = JSON.stringify(consoleError.mock.calls[0]);
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("test-server-secret");
  });
});
