import { NextResponse } from "next/server";
import { z } from "zod";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { hashValidationSecret, requireValidationAdmin } from "@/lib/validation/session";
import { createValidationCode, randomValidationToken } from "@/lib/validation/tokens";

export const runtime = "nodejs";

const actionSchema = z.object({ action: z.enum(["enable", "disable", "regenerate-code", "new-invite", "revoke-invites", "reset"]) });

function appUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireValidationAdmin();
    const { id } = await context.params;
    const { action } = actionSchema.parse(await request.json());
    const admin = createValidationAdminClient();
    const { data: workspace } = await admin.from("validation_workspaces").select("id, label").eq("id", id).maybeSingle();
    if (!workspace) return NextResponse.json({ error: "Tester workspace not found." }, { status: 404 });
    if (action === "enable" || action === "disable") {
      const { error } = await admin.from("validation_workspaces").update({ status: action === "enable" ? "active" : "disabled", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      if (action === "disable") { const { error: sessionError } = await admin.from("validation_sessions").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", id).is("revoked_at", null); if (sessionError) throw sessionError; }
      return NextResponse.json({ data: { ok: true } });
    }
    if (action === "regenerate-code") {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const code = createValidationCode(workspace.label);
        const { error } = await admin.from("validation_workspaces").update({ access_code_hash: await hashValidationSecret(code), updated_at: new Date().toISOString() }).eq("id", id);
        if (error?.code === "23505") continue;
        if (error) throw error;
        const { error: sessionError } = await admin.from("validation_sessions").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", id).is("revoked_at", null);
        if (sessionError) throw sessionError;
        return NextResponse.json({ data: { code } });
      }
      throw new Error("Could not allocate a unique test code.");
    }
    if (action === "revoke-invites") {
      const { error } = await admin.from("validation_invites").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", id).is("revoked_at", null);
      if (error) throw error;
      return NextResponse.json({ data: { ok: true } });
    }
    if (action === "new-invite") {
      const { error: revokeError } = await admin.from("validation_invites").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", id).is("revoked_at", null);
      if (revokeError) throw revokeError;
      const token = randomValidationToken();
      const { error } = await admin.from("validation_invites").insert({ workspace_id: id, token_hash: await hashValidationSecret(token), expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() });
      if (error) throw error;
      return NextResponse.json({ data: { inviteUrl: `${appUrl(request)}/test/${token}` } });
    }
    const { data: media } = await admin.from("validation_media_assets").select("storage_path").eq("workspace_id", id);
    if (media?.length) await admin.storage.from("validation-media").remove(media.map((item) => item.storage_path));
    const tables = ["validation_workspace_documents", "validation_public_requests", "validation_public_pages", "validation_import_operations", "validation_calendar_event_links", "validation_calendar_connections", "validation_invoice_sequences", "validation_google_oauth_states", "validation_media_assets"];
    for (const table of tables) { const { error } = await admin.from(table).delete().eq("workspace_id", id); if (error) throw error; }
    const { error: sessionError } = await admin.from("validation_sessions").update({ revoked_at: new Date().toISOString() }).eq("workspace_id", id).is("revoked_at", null);
    if (sessionError) throw sessionError;
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Could not update that tester workspace." }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireValidationAdmin();
    const { id } = await context.params;
    const admin = createValidationAdminClient();
    const { data: media } = await admin.from("validation_media_assets").select("storage_path").eq("workspace_id", id);
    if (media?.length) await admin.storage.from("validation-media").remove(media.map((item) => item.storage_path));
    const { error } = await admin.from("validation_workspaces").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Could not delete that tester workspace." }, { status: 400 });
  }
}
