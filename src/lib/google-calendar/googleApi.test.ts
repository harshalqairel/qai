import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOOGLE_CALENDAR_SCOPES,
  GoogleCalendarApiError,
  exchangeGoogleCalendarCode,
  googleCalendarApi,
  googleCalendarAuthorizationUrl,
  refreshGoogleCalendarToken,
} from "./googleApi";

describe("Google Calendar API boundary", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "calendar-client-id");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "server-only-client-secret");
    vi.stubEnv(
      "GOOGLE_REDIRECT_URI",
      "https://qai-git-codex-recovery-from-production-faul.vercel.app/api/integrations/google-calendar/callback",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requests only the established Calendar event and Calendar-list scopes", () => {
    const authorization = new URL(googleCalendarAuthorizationUrl("state", "challenge"));
    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual([...GOOGLE_CALENDAR_SCOPES]);
    expect(authorization.searchParams.get("redirect_uri")).toBe(
      "https://qai-git-codex-recovery-from-production-faul.vercel.app/api/integrations/google-calendar/callback",
    );
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("access_type")).toBe("offline");
  });

  it("sends the PKCE verifier only to Google's server-side token endpoint", async () => {
    const fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      expect(String(options?.body)).toContain("code_verifier=pkce-verifier");
      expect(String(options?.body)).toContain("client_secret=server-only-client-secret");
      return new Response(JSON.stringify({
        access_token: "access-token",
        expires_in: 3600,
        refresh_token: "refresh-token",
        token_type: "Bearer",
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(exchangeGoogleCalendarCode("authorization-code", "pkce-verifier"))
      .resolves.toMatchObject({ access_token: "access-token", refresh_token: "refresh-token" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never exposes raw Google response bodies through application errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: {
        status: "PERMISSION_DENIED",
        message: "private-provider-detail access-token-should-not-leak",
      },
    }), { status: 403 })));

    const failure = await googleCalendarApi("secret-access-token", "/users/me/calendarList")
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GoogleCalendarApiError);
    expect((failure as Error).message).toBe("Google Calendar operation failed.");
    expect(JSON.stringify(failure)).not.toContain("access-token-should-not-leak");
    expect(JSON.stringify(failure)).not.toContain("secret-access-token");
  });

  it("preserves only the sanitized OAuth error code for an invalid refresh grant", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "invalid_grant",
      error_description: "refresh-token-should-not-leak was revoked",
    }), { status: 400 })));

    const failure = await refreshGoogleCalendarToken("refresh-token-should-not-leak")
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GoogleCalendarApiError);
    expect(failure).toMatchObject({
      status: 400,
      reason: "authorization",
      providerCode: "invalid_grant",
    });
    expect(JSON.stringify(failure)).not.toContain("refresh-token-should-not-leak");
    expect(JSON.stringify(failure)).not.toContain("was revoked");
  });

  it("keeps network and provider failures sanitized and distinguishable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("private network detail");
    }));
    const networkFailure = await refreshGoogleCalendarToken("network-refresh-secret")
      .catch((error: unknown) => error);
    expect(networkFailure).toMatchObject({ status: 0, reason: "network", providerCode: null });
    expect(JSON.stringify(networkFailure)).not.toContain("network-refresh-secret");
    expect(JSON.stringify(networkFailure)).not.toContain("private network detail");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      error: "server_error",
      error_description: "provider-internal-detail",
    }), { status: 500 })));
    const providerFailure = await refreshGoogleCalendarToken("provider-refresh-secret")
      .catch((error: unknown) => error);
    expect(providerFailure).toMatchObject({
      status: 500,
      reason: "provider",
      providerCode: "server_error",
    });
    expect(JSON.stringify(providerFailure)).not.toContain("provider-refresh-secret");
    expect(JSON.stringify(providerFailure)).not.toContain("provider-internal-detail");
  });
});
