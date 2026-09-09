import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabasePublicConfig } from "@/lib/supabase/config";

/** Server-only client for narrowly scoped public Qai Space reads and writes. */
export function createCloudAdminClient() {
  const { url } = requireSupabasePublicConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error("Cloud storage is not configured.");
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function redactServerSecret(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  return secretKey ? value.replaceAll(secretKey, "[redacted]") : value;
}

export function logCloudFailure(operation: string, error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : {};
  console.error(`[QAI_CLOUD] ${operation} failed`, {
    name: redactServerSecret(error instanceof Error ? error.name : record.name),
    message: redactServerSecret(error instanceof Error ? error.message : record.message),
    code: redactServerSecret(record.code),
    stage: redactServerSecret(record.stage),
    details: redactServerSecret(record.details),
    hint: redactServerSecret(record.hint),
    status: redactServerSecret(record.status),
  });
}
