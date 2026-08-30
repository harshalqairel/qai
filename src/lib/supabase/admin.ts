import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "@/lib/supabase/config";

/** Server-only client for narrowly scoped public Qai Space reads and writes. */
export function createCloudAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error("Cloud storage is not configured.");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function logCloudFailure(operation: string, error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  console.error(`[QAI_CLOUD] ${operation} failed`, {
    name: error instanceof Error ? error.name : record.name,
    message: error instanceof Error ? error.message : record.message,
    code: record.code,
    stage: record.stage,
    details: record.details,
    hint: record.hint,
    status: record.status,
  });
}
