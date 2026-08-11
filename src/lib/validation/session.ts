import "server-only";

import { cookies } from "next/headers";

import { createValidationAdminClient } from "./admin";

export const VALIDATION_SESSION_COOKIE = "qai_validation_session";
export const VALIDATION_ADMIN_COOKIE = "qai_validation_admin";
const SESSION_DAYS = 30;

type SessionPayload = {
  kind: "workspace";
  sessionId: string;
  workspaceId: string;
  expiresAt: number;
};

type AdminPayload = { kind: "founder"; expiresAt: number };
type SignedPayload = SessionPayload | AdminPayload;

function secret(): string {
  const value = process.env.QAI_VALIDATION_SESSION_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("Validation session signing is not configured.");
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

async function hmac(value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function hashValidationSecret(value: string): Promise<string> {
  return toBase64Url(await hmac(value.trim().toUpperCase()));
}

export async function signValidationPayload(payload: SignedPayload): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${toBase64Url(await hmac(encoded))}`;
}

export async function verifyValidationPayload(value: string | undefined): Promise<SignedPayload | null> {
  if (!value) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(encoded));
    if (!valid) return null;
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as SignedPayload;
    if (!parsed || parsed.expiresAt <= Date.now()) return null;
    if (parsed.kind === "founder") return parsed;
    return parsed.kind === "workspace" && parsed.sessionId && parsed.workspaceId ? parsed : null;
  } catch {
    return null;
  }
}

export function validationCookieOptions(expiresAt: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: new Date(expiresAt),
  };
}

export async function createWorkspaceSession(workspaceId: string): Promise<string> {
  const admin = createValidationAdminClient();
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const { data, error } = await admin
    .from("validation_sessions")
    .insert({ workspace_id: workspaceId, expires_at: new Date(expiresAt).toISOString() })
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not create validation session.");
  return signValidationPayload({ kind: "workspace", sessionId: data.id, workspaceId, expiresAt });
}

export async function signWorkspaceSession(sessionId: string, workspaceId: string, expiresAt: number): Promise<string> {
  return signValidationPayload({ kind: "workspace", sessionId, workspaceId, expiresAt });
}

export async function requireValidationSession(): Promise<SessionPayload> {
  const cookieStore = await cookies();
  const payload = await verifyValidationPayload(cookieStore.get(VALIDATION_SESSION_COOKIE)?.value);
  if (!payload || payload.kind !== "workspace") throw new Error("VALIDATION_SESSION_REQUIRED");
  const admin = createValidationAdminClient();
  const { data } = await admin
    .from("validation_sessions")
    .select("id, workspace_id, expires_at, revoked_at, validation_workspaces!inner(status)")
    .eq("id", payload.sessionId)
    .eq("workspace_id", payload.workspaceId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .eq("validation_workspaces.status", "active")
    .maybeSingle();
  if (!data) throw new Error("VALIDATION_SESSION_REQUIRED");
  void admin.from("validation_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", payload.sessionId);
  return payload;
}

export async function requireValidationAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const payload = await verifyValidationPayload(cookieStore.get(VALIDATION_ADMIN_COOKIE)?.value);
  if (!payload || payload.kind !== "founder") throw new Error("VALIDATION_ADMIN_REQUIRED");
}

export async function createAdminSession(): Promise<{ value: string; expiresAt: number }> {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  return { value: await signValidationPayload({ kind: "founder", expiresAt }), expiresAt };
}
