import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { VALIDATION_ADMIN_COOKIE, VALIDATION_SESSION_COOKIE, verifyValidationPayload } from "@/lib/validation/session";

function isValidationPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/test/") || pathname.startsWith("/q/") || pathname === "/manifest.webmanifest"
    || pathname === "/api/validation" || pathname.startsWith("/api/validation/media/") || pathname === "/api/validation/access" || pathname === "/api/validation/admin/login" || pathname === "/api/integrations/google-calendar/callback";
}

export async function proxy(request: NextRequest) {
  if (isValidationModeEnabled()) {
    const { pathname } = request.nextUrl;
    if (isValidationPublicPath(pathname)) return NextResponse.next({ request });
    if (pathname.startsWith("/validation/founder")) {
      const admin = await verifyValidationPayload(request.cookies.get(VALIDATION_ADMIN_COOKIE)?.value);
      if (pathname === "/validation/founder/login") {
        return admin?.kind === "founder" ? NextResponse.redirect(new URL("/validation/founder", request.url)) : NextResponse.next({ request });
      }
      return admin?.kind === "founder" ? NextResponse.next({ request }) : NextResponse.redirect(new URL("/validation/founder/login", request.url));
    }
    if (pathname.startsWith("/api/validation/admin/")) return NextResponse.next({ request });
    const session = await verifyValidationPayload(request.cookies.get(VALIDATION_SESSION_COOKIE)?.value);
    if (session?.kind === "workspace") return NextResponse.next({ request });
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Validation access is required." }, { status: 401 });
    return NextResponse.redirect(new URL("/", request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
