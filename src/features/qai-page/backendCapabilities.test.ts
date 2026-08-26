import { describe, expect, it } from "vitest";

import {
  loadValidationBackendCapabilities,
  VALIDATION_MANAGED_AVAILABILITY_MIGRATION,
  VALIDATION_REQUEST_IDEMPOTENCY_MIGRATION,
} from "./backendCapabilities";

function client(data: unknown, error: { code?: string; message?: string } | null = null) {
  return {
    rpc: () => ({ maybeSingle: async () => ({ data, error }) }),
  };
}

describe("validation backend capabilities", () => {
  it("reports the fully migrated capability response", async () => {
    await expect(loadValidationBackendCapabilities(client({
      supportsManagedAvailability: true,
      supportsRequestBookingIdempotency: true,
    }))).resolves.toEqual({
      supportsManagedAvailability: true,
      supportsRequestBookingIdempotency: true,
      status: "ready",
    });
  });

  it("classifies a missing read-only capability RPC as pending migrations", async () => {
    await expect(loadValidationBackendCapabilities(client(null, {
      code: "PGRST202",
      message: "Could not find the function public.validation_backend_capabilities in the schema cache",
    }))).resolves.toMatchObject({
      supportsManagedAvailability: false,
      supportsRequestBookingIdempotency: false,
      status: "migration-required",
    });
    expect(VALIDATION_MANAGED_AVAILABILITY_MIGRATION).toBe("202608250001");
    expect(VALIDATION_REQUEST_IDEMPOTENCY_MIGRATION).toBe("202608260001");
  });

  it("does not misclassify permission or transport failures as missing migrations", async () => {
    await expect(loadValidationBackendCapabilities(client(null, {
      code: "42501",
      message: "permission denied",
    }))).resolves.toMatchObject({ status: "check-failed" });
  });
});
