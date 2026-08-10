import { NextResponse, type NextRequest } from "next/server";

import { isCloudModeEnabled } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (isCloudModeEnabled() && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: membership } = await supabase
        .from("business_memberships")
        .select("business_id")
        .limit(1)
        .maybeSingle();
      const destination = membership ? nextPath : "/onboarding";
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(loginUrl);
}
