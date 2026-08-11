import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSession, VALIDATION_ADMIN_COOKIE, validationCookieOptions } from "@/lib/validation/session";

export const runtime = "nodejs";

const inputSchema = z.object({ secret: z.string().min(1).max(500) });

export async function POST(request: Request) {
  try {
    const { secret } = inputSchema.parse(await request.json());
    const expected = process.env.QAI_VALIDATION_ADMIN_SECRET ?? "";
    const actualBuffer = Buffer.from(secret);
    const expectedBuffer = Buffer.from(expected);
    if (!expected || actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
      return NextResponse.json({ error: "That founder credential isn't valid." }, { status: 401 });
    }
    const session = await createAdminSession();
    const response = NextResponse.json({ data: { next: "/validation/founder" } });
    response.cookies.set(VALIDATION_ADMIN_COOKIE, session.value, validationCookieOptions(session.expiresAt));
    return response;
  } catch {
    return NextResponse.json({ error: "That founder credential isn't valid." }, { status: 401 });
  }
}
