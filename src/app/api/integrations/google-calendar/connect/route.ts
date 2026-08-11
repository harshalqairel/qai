import { NextRequest, NextResponse } from "next/server";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { codeChallenge, codeVerifier, googleAuthorizationUrl } from "@/lib/validation/googleCalendar";
import { encryptValidationSecret } from "@/lib/validation/encryption";
import { hashValidationSecret, requireValidationSession } from "@/lib/validation/session";
import { randomValidationToken } from "@/lib/validation/tokens";

export async function GET(request: NextRequest) {
  try {
    const session = await requireValidationSession(); const state = randomValidationToken(); const verifier = codeVerifier(); const admin = createValidationAdminClient();
    const { error } = await admin.from("validation_google_oauth_states").insert({ workspace_id: session.workspaceId, state_hash: await hashValidationSecret(state), encrypted_code_verifier: encryptValidationSecret(verifier), expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    if (error) throw error;
    return NextResponse.redirect(googleAuthorizationUrl(state, codeChallenge(verifier)));
  } catch { return NextResponse.redirect(new URL("/calendar?calendar=not-configured", request.url)); }
}
