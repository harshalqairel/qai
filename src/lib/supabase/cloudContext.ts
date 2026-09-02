import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function requireCloudBusinessContext() {
  const client = await createClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("AUTH_REQUIRED");

  const { data: membership, error: membershipError } = await client
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership?.business_id) throw new Error("BUSINESS_REQUIRED");

  const { data: business, error: businessError } = await client
    .from("businesses")
    .select("id, name, timezone")
    .eq("id", membership.business_id)
    .single();
  if (businessError || !business) throw businessError ?? new Error("BUSINESS_REQUIRED");

  return {
    client,
    userId: auth.user.id,
    businessId: String(business.id),
    businessName: typeof business.name === "string" ? business.name : "Qai Business",
    timezone: typeof business.timezone === "string" ? business.timezone : "Asia/Jakarta",
  };
}
