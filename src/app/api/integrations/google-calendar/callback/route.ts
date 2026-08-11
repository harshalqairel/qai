import { NextRequest, NextResponse } from "next/server";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { decryptValidationSecret, encryptValidationSecret } from "@/lib/validation/encryption";
import { exchangeGoogleCode, googleApi } from "@/lib/validation/googleCalendar";
import { hashValidationSecret } from "@/lib/validation/session";

type CalendarList = { items?: Array<{ id: string; summary: string; primary?: boolean; accessRole?: string }> };

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code"); const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || request.nextUrl.searchParams.get("error")) return NextResponse.redirect(new URL("/calendar?calendar=cancelled", request.url));
  try {
    const admin = createValidationAdminClient(); const now = new Date().toISOString(); const stateHash = await hashValidationSecret(state);
    const { data: oauth } = await admin.from("validation_google_oauth_states").select("id, workspace_id, encrypted_code_verifier").eq("state_hash", stateHash).is("consumed_at", null).gt("expires_at", now).maybeSingle();
    if (!oauth) throw new Error("Invalid OAuth state.");
    const tokens = await exchangeGoogleCode(code, decryptValidationSecret(oauth.encrypted_code_verifier));
    const calendars = await googleApi<CalendarList>(tokens.access_token, "/users/me/calendarList?minAccessRole=writer"); const primary = calendars.items?.find((item) => item.primary) ?? calendars.items?.[0];
    const { data: existing } = await admin.from("validation_calendar_connections").select("encrypted_refresh_token, google_account_email").eq("workspace_id", oauth.workspace_id).maybeSingle();
    const accountChanged = Boolean(existing?.google_account_email && primary?.id && existing.google_account_email !== primary.id);
    const { error: connectionError } = await admin.from("validation_calendar_connections").upsert({ workspace_id: oauth.workspace_id, google_account_email: primary?.id ?? null, target_calendar_id: primary?.id ?? "primary", encrypted_access_token: encryptValidationSecret(tokens.access_token), encrypted_refresh_token: tokens.refresh_token ? encryptValidationSecret(tokens.refresh_token) : existing?.encrypted_refresh_token ?? null, token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), scope: tokens.scope ?? "", status: "connected", last_error: null, updated_at: now }, { onConflict: "workspace_id" });
    if (connectionError) throw connectionError;
    if (accountChanged) { const { error } = await admin.from("validation_calendar_event_links").delete().eq("workspace_id", oauth.workspace_id); if (error) throw error; }
    const { error: stateError } = await admin.from("validation_google_oauth_states").update({ consumed_at: now }).eq("id", oauth.id);
    if (stateError) throw stateError;
    return NextResponse.redirect(new URL("/calendar?calendar=connected", request.url));
  } catch { return NextResponse.redirect(new URL("/calendar?calendar=error", request.url)); }
}
