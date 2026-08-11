import { NextResponse } from "next/server";
import { z } from "zod";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { normalizeValidationCode } from "@/lib/validation/tokens";
import {
  createWorkspaceSession,
  hashValidationSecret,
  VALIDATION_SESSION_COOKIE,
  validationCookieOptions,
  verifyValidationPayload,
} from "@/lib/validation/session";

export const runtime = "nodejs";

const inputSchema = z.object({ code: z.string().min(4).max(40) });

export async function POST(request: Request) {
  try {
    const { code } = inputSchema.parse(await request.json());
    const admin = createValidationAdminClient();
    const codeHash = await hashValidationSecret(normalizeValidationCode(code));
    const { data } = await admin
      .from("validation_workspaces")
      .select("id")
      .eq("access_code_hash", codeHash)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return NextResponse.json({ error: "That test code isn't valid." }, { status: 401 });
    const value = await createWorkspaceSession(data.id);
    const payload = await verifyValidationPayload(value);
    if (!payload) throw new Error("Session creation failed.");
    await admin.from("validation_workspaces").update({ last_access_at: new Date().toISOString() }).eq("id", data.id);
    const response = NextResponse.json({ data: { next: "/dashboard" } });
    response.cookies.set(VALIDATION_SESSION_COOKIE, value, validationCookieOptions(payload.expiresAt));
    return response;
  } catch {
    return NextResponse.json({ error: "That test code isn't valid." }, { status: 401 });
  }
}
