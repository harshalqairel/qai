import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "@/lib/supabase/config";

export function createValidationAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("Validation storage is not configured.");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function diagnosticField(error: unknown, field: string): string | number | undefined {
  if (!error || typeof error !== "object" || !(field in error)) return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

export function logValidationAdminFailure(operation: string, error: unknown) {
  console.error(`[QAI_VALIDATION] ${operation} failed`, {
    name: error instanceof Error ? error.name : diagnosticField(error, "name"),
    message: error instanceof Error ? error.message : diagnosticField(error, "message"),
    code: diagnosticField(error, "code"),
    details: diagnosticField(error, "details"),
    hint: diagnosticField(error, "hint"),
    status: diagnosticField(error, "status"),
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  });
}
