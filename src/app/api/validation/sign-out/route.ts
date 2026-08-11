import { NextResponse } from "next/server";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { VALIDATION_SESSION_COOKIE, validationCookieOptions, verifyValidationPayload } from "@/lib/validation/session";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${VALIDATION_SESSION_COOKIE}=([^;]+)`))?.[1];
  const payload = await verifyValidationPayload(cookie ? decodeURIComponent(cookie) : undefined);
  if (payload?.kind === "workspace") {
    const admin = createValidationAdminClient();
    await admin.from("validation_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", payload.sessionId);
  }
  const response = NextResponse.json({ data: true });
  response.cookies.set(VALIDATION_SESSION_COOKIE, "", validationCookieOptions(0));
  return response;
}
