import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole?: string;
};

export type GoogleCalendarList = {
  items?: GoogleCalendarListEntry[];
};

export class GoogleCalendarApiError extends Error {
  readonly status: number;
  readonly reason: string;
  readonly providerCode: string | null;

  constructor(status: number, reason: string, providerCode: string | null = null) {
    super("Google Calendar operation failed.");
    this.name = "GoogleCalendarApiError";
    this.status = status;
    this.reason = reason;
    this.providerCode = providerCode;
  }
}

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()
    || (configuredOrigin ? `${configuredOrigin}/api/integrations/google-calendar/callback` : "");
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google Calendar is not configured.");
  }
  return { clientId, clientSecret, redirectUri };
}

export function googleCalendarConfigured(): boolean {
  try {
    googleConfig();
    return true;
  } catch {
    return false;
  }
}

export function googleCalendarCodeVerifier(): string {
  return randomBytes(48).toString("base64url");
}

export function googleCalendarCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function googleCalendarOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function googleCalendarStateHash(state: string): string {
  return createHash("sha256").update(state).digest("base64url");
}

export function googleCalendarAuthorizationUrl(state: string, challenge: string): string {
  const config = googleConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function fetchSignal(): AbortSignal {
  return AbortSignal.timeout(20_000);
}

async function tokenRequest(body: URLSearchParams): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: fetchSignal(),
  }).catch(() => {
    throw new GoogleCalendarApiError(0, "network");
  });
  if (!response.ok) {
    const responseBody = await response.json().catch(() => null);
    const providerCode = safeGoogleTokenErrorCode(responseBody);
    throw new GoogleCalendarApiError(
      response.status,
      providerCode === "invalid_grant" ? "authorization" : "provider",
      providerCode,
    );
  }
  return response.json() as Promise<GoogleTokenResponse>;
}

export async function exchangeGoogleCalendarCode(
  code: string,
  verifier: string,
): Promise<GoogleTokenResponse> {
  const config = googleConfig();
  return tokenRequest(new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: verifier,
  }));
}

export async function refreshGoogleCalendarToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const config = googleConfig();
  return tokenRequest(new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }));
}

function safeGoogleReason(value: unknown): string {
  if (!value || typeof value !== "object") return "provider";
  const body = value as { error?: { status?: unknown; errors?: Array<{ reason?: unknown }> } };
  const candidate = body.error?.errors?.[0]?.reason ?? body.error?.status;
  return typeof candidate === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(candidate)
    ? candidate
    : "provider";
}

function safeGoogleTokenErrorCode(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as { error?: unknown }).error;
  return typeof candidate === "string" && /^[A-Za-z0-9_.-]{1,80}$/.test(candidate)
    ? candidate
    : null;
}

export async function googleCalendarApi<T>(
  accessToken: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
    signal: options?.signal ?? fetchSignal(),
  }).catch(() => {
    throw new GoogleCalendarApiError(0, "network");
  });

  if (!response.ok) {
    const responseBody = await response.json().catch(() => null);
    throw new GoogleCalendarApiError(response.status, safeGoogleReason(responseBody));
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export async function revokeGoogleCalendarToken(token: string): Promise<boolean> {
  const response = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    { method: "POST", cache: "no-store", signal: fetchSignal() },
  ).catch(() => null);
  return Boolean(response?.ok);
}
