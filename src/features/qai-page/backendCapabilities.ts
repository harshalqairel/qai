import { z } from "zod";

export const VALIDATION_MANAGED_AVAILABILITY_MIGRATION = "202608250001";
export const VALIDATION_REQUEST_IDEMPOTENCY_MIGRATION = "202608260001";

export const validationBackendCapabilitiesSchema = z.object({
  supportsManagedAvailability: z.boolean(),
  supportsRequestBookingIdempotency: z.boolean(),
});

export type ValidationBackendCapabilities = z.infer<typeof validationBackendCapabilitiesSchema> & {
  status: "ready" | "migration-required" | "check-failed";
};

export const LOCAL_VALIDATION_BACKEND_CAPABILITIES: ValidationBackendCapabilities = {
  supportsManagedAvailability: true,
  supportsRequestBookingIdempotency: true,
  status: "ready",
};

type CapabilityRpcError = { code?: string; message?: string } | null;

type CapabilityClient = {
  rpc(name: string): {
    maybeSingle(): PromiseLike<{ data: unknown; error: CapabilityRpcError }>;
  };
};

export function isMissingCapabilityRpc(error: CapabilityRpcError): boolean {
  if (!error) return false;
  return error.code === "PGRST202"
    || error.code === "42883"
    || /could not find the function|does not exist/i.test(error.message ?? "");
}

/**
 * One read-only RPC is the capability boundary for validation workspaces. It
 * is added only after the availability and idempotency migrations, so the UI
 * can fail early without probing a mutating capacity operation.
 */
export async function loadValidationBackendCapabilities(
  client: CapabilityClient,
): Promise<ValidationBackendCapabilities> {
  const { data, error } = await client.rpc("validation_backend_capabilities").maybeSingle();
  if (error) {
    return {
      supportsManagedAvailability: false,
      supportsRequestBookingIdempotency: false,
      status: isMissingCapabilityRpc(error) ? "migration-required" : "check-failed",
    };
  }
  const parsed = validationBackendCapabilitiesSchema.safeParse(data);
  if (!parsed.success) {
    return {
      supportsManagedAvailability: false,
      supportsRequestBookingIdempotency: false,
      status: "check-failed",
    };
  }
  return { ...parsed.data, status: "ready" };
}
