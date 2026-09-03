import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicConfig, isCloudModeEnabled } from "./config";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/manifest.webmanifest",
  "/privacy",
  "/pricing",
  "/terms",
]);

export function isCloudPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname)
    || pathname.startsWith("/auth/")
    || pathname.startsWith("/q/")
    || pathname === "/api/qai-space"
    || pathname.startsWith("/api/qai-space/media/")
    || pathname === "/api/qai-space/public-media"
    || pathname.startsWith("/api/qai-space/public-media/");
}

function copyAuthState(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"] as const) {
    const value = source.headers.get(header);
    if (value) target.headers.set(header, value);
  }
  return target;
}

export async function updateSession(request: NextRequest) {
  const config = getSupabasePublicConfig();
  if (!config || !isCloudModeEnabled()) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  if (!isAuthenticated && !isCloudPublicRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return copyAuthState(response, NextResponse.redirect(loginUrl));
  }

  if (isAuthenticated && pathname === "/login") {
    return copyAuthState(
      response,
      NextResponse.redirect(new URL("/dashboard", request.url)),
    );
  }

  return response;
}
