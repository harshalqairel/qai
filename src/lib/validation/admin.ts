import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "@/lib/supabase/config";

export function createValidationAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("Validation storage is not configured.");
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function diagnosticField(error: unknown, field: string): string | number | undefined {
  if (!error || typeof error !== "object" || !(field in error)) return undefined;
  const value = (error as Record<string, unknown>)[field];
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  return secretKey ? value.replaceAll(secretKey, "[redacted]") : value;
}

export function logValidationAdminFailure(operation: string, error: unknown) {
  console.error(`[QAI_VALIDATION] ${operation} failed`, {
    name: error instanceof Error ? diagnosticField({ name: error.name }, "name") : diagnosticField(error, "name"),
    message: error instanceof Error ? diagnosticField({ message: error.message }, "message") : diagnosticField(error, "message"),
    code: diagnosticField(error, "code"),
    details: diagnosticField(error, "details"),
    hint: diagnosticField(error, "hint"),
    status: diagnosticField(error, "status"),
    supabaseUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    secretKeyConfigured: Boolean(process.env.SUPABASE_SECRET_KEY?.trim()),
  });
}
