import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(() => ({ kind: "validation-admin" })) }));

vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));

import { createValidationAdminClient, logValidationAdminFailure } from "./admin";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); mocks.createClient.mockClear(); });

describe("validation admin diagnostics", () => {
  it("creates the server client with SUPABASE_SECRET_KEY", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret");

    expect(createValidationAdminClient()).toEqual({ kind: "validation-admin" });
    expect(mocks.createClient).toHaveBeenCalledWith(
      "https://project-ref.supabase.co",
      "test-server-secret",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("rejects a legacy service-role variable when the new secret is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-server-key");

    expect(() => createValidationAdminClient()).toThrow("Validation storage is not configured.");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("logs safe error fields and configuration presence without secret values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-secret");
    vi.stubEnv("QAI_VALIDATION_ADMIN_SECRET", "founder-secret-value");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logValidationAdminFailure("founder workspace load", { name: "PostgrestError", message: "relation unavailable: test-server-secret", code: "PGRST205", details: "schema cache", hint: "reload", status: 500 });

    expect(consoleError).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(consoleError.mock.calls[0]);
    expect(serialized).toContain("[QAI_VALIDATION] founder workspace load failed");
    expect(serialized).toContain("PGRST205");
    expect(serialized).toContain('"supabaseUrlConfigured":true');
    expect(serialized).toContain('"secretKeyConfigured":true');
    expect(serialized).toContain("[redacted]");
    expect(serialized).not.toContain("test-server-secret");
    expect(serialized).not.toContain("founder-secret-value");
    expect(serialized).not.toContain("project-ref.supabase.co");
  });
});
