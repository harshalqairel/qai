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
