import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createValidationAdminClient } from "./admin";
import { decryptValidationSecret, encryptValidationSecret } from "./encryption";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim(); const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")}/api/integrations/google-calendar/callback`;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Google Calendar is not configured.");
  return { clientId, clientSecret, redirectUri };
}

export function googleCalendarConfigured(): boolean { try { googleConfig(); return true; } catch { return false; } }
export function codeVerifier(): string { return randomBytes(48).toString("base64url"); }
export function codeChallenge(verifier: string): string { return createHash("sha256").update(verifier).digest("base64url"); }

export function googleAuthorizationUrl(state: string, challenge: string): string {
  const config = googleConfig(); const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "false", scope: GOOGLE_CALENDAR_SCOPES.join(" "), state, code_challenge: challenge, code_challenge_method: "S256" });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; token_type: string };

export async function exchangeGoogleCode(code: string, verifier: string): Promise<TokenResponse> {
  const config = googleConfig(); const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: verifier }), cache: "no-store" });
  if (!response.ok) throw new Error("Google authorization could not be completed."); return response.json() as Promise<TokenResponse>;
}

async function refreshGoogleToken(refreshToken: string): Promise<TokenResponse> {
  const config = googleConfig(); const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }), cache: "no-store" });
  if (!response.ok) throw new Error("Google Calendar must be reconnected."); return response.json() as Promise<TokenResponse>;
}

export async function workspaceGoogleAccessToken(workspaceId: string): Promise<{ accessToken: string; calendarId: string; connection: Record<string, unknown> }> {
  const admin = createValidationAdminClient(); const { data: connection } = await admin.from("validation_calendar_connections").select("*").eq("workspace_id", workspaceId).maybeSingle();
  if (!connection || connection.status !== "connected" || !connection.encrypted_access_token) throw new Error("Google Calendar is not connected.");
  let accessToken = decryptValidationSecret(connection.encrypted_access_token); const expiresAt = connection.token_expires_at ? Date.parse(connection.token_expires_at) : 0;
  if (expiresAt < Date.now() + 60_000) {
    if (!connection.encrypted_refresh_token) { await admin.from("validation_calendar_connections").update({ status: "reconnect_required", last_error: "Refresh token unavailable" }).eq("workspace_id", workspaceId); throw new Error("Google Calendar must be reconnected."); }
    try { const refreshed = await refreshGoogleToken(decryptValidationSecret(connection.encrypted_refresh_token)); accessToken = refreshed.access_token; await admin.from("validation_calendar_connections").update({ encrypted_access_token: encryptValidationSecret(accessToken), token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(), status: "connected", last_error: null }).eq("workspace_id", workspaceId); }
    catch (error) { await admin.from("validation_calendar_connections").update({ status: "reconnect_required", last_error: "Token refresh failed" }).eq("workspace_id", workspaceId); throw error; }
  }
  return { accessToken, calendarId: connection.target_calendar_id || "primary", connection };
}

export async function googleApi<T>(accessToken: string, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, { ...options, headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(options?.headers ?? {}) }, cache: "no-store" });
  if (options?.method === "DELETE" && (response.status === 404 || response.status === 410)) return undefined as T;
  if (!response.ok) { const detail = await response.text(); throw new Error(`Google Calendar request failed (${response.status}): ${detail.slice(0, 160)}`); }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
