import { NextRequest, NextResponse } from "next/server";

import { beginCloudGoogleCalendarOAuth, CloudCalendarError } from "@/lib/google-calendar/cloudConnection";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { requireCloudBusinessAdminContext } from "@/lib/supabase/cloudContext";
import { createValidationAdminClient } from "@/lib/validation/admin";
import { codeChallenge, codeVerifier, googleAuthorizationUrl } from "@/lib/validation/googleCalendar";
import { encryptValidationSecret } from "@/lib/validation/encryption";
import { hashValidationSecret, requireValidationSession } from "@/lib/validation/session";
import { randomValidationToken } from "@/lib/validation/tokens";

export async function GET(request: NextRequest) {
  if (isCloudModeEnabled()) {
    try {
      const context = await requireCloudBusinessAdminContext();
      const authorizationUrl = await beginCloudGoogleCalendarOAuth(context.businessId, context.userId);
      return NextResponse.redirect(authorizationUrl);
    } catch (error) {
      const reason = error instanceof CloudCalendarError ? error.code : "error";
      const destination = new URL("/settings", request.url);
      destination.searchParams.set("section", "integrations");
      destination.searchParams.set("calendar", reason === "not_configured" ? "not-configured" : "error");
      return NextResponse.redirect(destination);
    }
  }

  try {
    const session = await requireValidationSession(); const state = randomValidationToken(); const verifier = codeVerifier(); const admin = createValidationAdminClient();
    const { error } = await admin.from("validation_google_oauth_states").insert({ workspace_id: session.workspaceId, state_hash: await hashValidationSecret(state), encrypted_code_verifier: encryptValidationSecret(verifier), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (error) throw error;
    return NextResponse.redirect(googleAuthorizationUrl(state, codeChallenge(verifier)));
  } catch { return NextResponse.redirect(new URL("/settings?section=integrations&calendar=not-configured", request.url)); }
}
