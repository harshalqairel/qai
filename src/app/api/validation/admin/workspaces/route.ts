import { NextResponse } from "next/server";
import { z } from "zod";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { hashValidationSecret, requireValidationAdmin } from "@/lib/validation/session";
import { createValidationCode, randomValidationToken, validationSlug } from "@/lib/validation/tokens";

export const runtime = "nodejs";

const inputSchema = z.object({ label: z.string().trim().min(1).max(120) });

function appUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin).replace(/\/$/, "");
}

async function uniqueCode(label: string) {
  const admin = createValidationAdminClient();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = createValidationCode(label);
    const codeHash = await hashValidationSecret(code);
    const { count } = await admin.from("validation_workspaces").select("id", { count: "exact", head: true }).eq("access_code_hash", codeHash);
    if (!count) return { code, codeHash };
  }
  throw new Error("Could not allocate a unique test code.");
}

async function uniqueSlug(label: string) {
  const admin = createValidationAdminClient();
  const base = validationSlug(label);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { count } = await admin.from("validation_workspaces").select("id", { count: "exact", head: true }).eq("public_slug", slug);
    if (!count) return slug;
  }
  return `${base}-${randomValidationToken(4).toLowerCase()}`;
}

export async function GET() {
  try {
    await requireValidationAdmin();
    const admin = createValidationAdminClient();
    const { data, error } = await admin
      .from("validation_workspaces")
      .select("id, label, public_slug, status, created_at, last_access_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Founder access is required." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireValidationAdmin();
    const { label } = inputSchema.parse(await request.json());
    const admin = createValidationAdminClient();
    const [{ code, codeHash }, slug] = await Promise.all([uniqueCode(label), uniqueSlug(label)]);
    const { data: workspace, error } = await admin
      .from("validation_workspaces")
      .insert({ label, public_slug: slug, access_code_hash: codeHash })
      .select("id, label, public_slug, status, created_at, last_access_at")
      .single();
    if (error || !workspace) throw error;
    const inviteToken = randomValidationToken();
    const { error: inviteError } = await admin.from("validation_invites").insert({
      workspace_id: workspace.id,
      token_hash: await hashValidationSecret(inviteToken),
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (inviteError) {
      await admin.from("validation_workspaces").delete().eq("id", workspace.id);
      throw inviteError;
    }
    return NextResponse.json({ data: { workspace, code, inviteUrl: `${appUrl(request)}/test/${inviteToken}` } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create that tester workspace." }, { status: 400 });
  }
}
