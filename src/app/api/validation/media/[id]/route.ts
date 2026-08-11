import { NextResponse } from "next/server";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { requireValidationSession } from "@/lib/validation/session";
import { qaiPageSchema } from "@/features/qai-page/validation";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const admin = createValidationAdminClient();
    const { data: asset } = await admin.from("validation_media_assets").select("workspace_id, kind, storage_path, mime_type").eq("id", id).maybeSingle();
    if (!asset) return new NextResponse(null, { status: 404 });
    let ownerAccess = false;
    try { ownerAccess = (await requireValidationSession()).workspaceId === asset.workspace_id; } catch { ownerAccess = false; }
    if (!ownerAccess) {
      if (!["page-logo", "page-cover", "portfolio"].includes(asset.kind)) return new NextResponse(null, { status: 404 });
      const { data: pageRow } = await admin.from("validation_public_pages").select("payload").eq("workspace_id", asset.workspace_id).maybeSingle();
      if (!pageRow) return new NextResponse(null, { status: 404 });
      const page = qaiPageSchema.parse(pageRow.payload); const url = `/api/validation/media/${id}`;
      const published = asset.kind === "page-logo" ? page.logo === url : asset.kind === "page-cover" ? page.coverImage === url : page.portfolio.some((item) => item.visible && item.imageUrl === url);
      if (!published) return new NextResponse(null, { status: 404 });
    }
    const { data, error } = await admin.storage.from("validation-media").download(asset.storage_path);
    if (error || !data) throw error;
    return new NextResponse(await data.arrayBuffer(), { headers: { "Content-Type": asset.mime_type, "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff" } });
  } catch { return new NextResponse(null, { status: 404 }); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireValidationSession();
    const { id } = await context.params;
    const admin = createValidationAdminClient();
    const { data: asset } = await admin.from("validation_media_assets").select("storage_path").eq("workspace_id", session.workspaceId).eq("id", id).maybeSingle();
    if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    await admin.storage.from("validation-media").remove([asset.storage_path]);
    await admin.from("validation_media_assets").delete().eq("workspace_id", session.workspaceId).eq("id", id);
    return NextResponse.json({ data: { ok: true } });
  } catch { return NextResponse.json({ error: "Could not remove that image." }, { status: 400 }); }
}
