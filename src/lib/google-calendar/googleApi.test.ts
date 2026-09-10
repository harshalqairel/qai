import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOOGLE_CALENDAR_SCOPES,
  GoogleCalendarApiError,
  exchangeGoogleCalendarCode,
  googleCalendarApi,
  googleCalendarAuthorizationUrl,
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
});
