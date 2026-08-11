import { afterEach, describe, expect, it, vi } from "vitest";

import { logValidationAdminFailure } from "./admin";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("validation admin diagnostics", () => {
  it("logs safe error fields and configuration presence without secret values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret-value");
    vi.stubEnv("QAI_VALIDATION_ADMIN_SECRET", "founder-secret-value");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logValidationAdminFailure("founder workspace load", { name: "PostgrestError", message: "relation unavailable", code: "PGRST205", details: "schema cache", hint: "reload", status: 500 });

    expect(consoleError).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(consoleError.mock.calls[0]);
    expect(serialized).toContain("[QAI_VALIDATION] founder workspace load failed");
    expect(serialized).toContain("PGRST205");
    expect(serialized).toContain('"supabaseUrlConfigured":true');
    expect(serialized).toContain('"serviceRoleConfigured":true');
    expect(serialized).not.toContain("service-role-secret-value");
    expect(serialized).not.toContain("founder-secret-value");
    expect(serialized).not.toContain("project-ref.supabase.co");
  });
});
