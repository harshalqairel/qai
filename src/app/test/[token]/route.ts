import { NextRequest, NextResponse } from "next/server";

import { createValidationAdminClient } from "@/lib/validation/admin";
import {
  hashValidationSecret,
  signWorkspaceSession,
  VALIDATION_SESSION_COOKIE,
  validationCookieOptions,
  verifyValidationPayload,
} from "@/lib/validation/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  try {
    const tokenHash = await hashValidationSecret(token);
    const admin = createValidationAdminClient();
    const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const { data } = await admin.rpc("exchange_validation_invite", { target_token_hash: tokenHash, target_session_expires_at: new Date(expiresAt).toISOString() }).maybeSingle();
    const exchange = data as { session_id: string; workspace_id: string } | null;
    if (!exchange) return NextResponse.redirect(new URL("/?invite=invalid", request.url));
    const value = await signWorkspaceSession(exchange.session_id, exchange.workspace_id, expiresAt);
    const payload = await verifyValidationPayload(value);
    if (!payload) throw new Error("Session creation failed.");
    await admin.from("validation_workspaces").update({ last_access_at: new Date().toISOString() }).eq("id", exchange.workspace_id);
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.set(VALIDATION_SESSION_COOKIE, value, validationCookieOptions(payload.expiresAt));
    return response;
  } catch {
    return NextResponse.redirect(new URL("/?invite=invalid", request.url));
  }
}
