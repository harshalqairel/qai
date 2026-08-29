import { NextResponse } from "next/server";

import { qaiPageSchema } from "@/features/qai-page/validation";
import { createCloudAdminClient } from "@/lib/supabase/admin";
import { requireCloudBusinessContext } from "@/lib/supabase/cloudContext";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const admin = createCloudAdminClient();
    const { data: asset, error } = await admin.from("qai_space_media_assets").select("business_id, kind, storage_path, mime_type").eq("id", id).maybeSingle();
    if (error || !asset) return new NextResponse(null, { status: 404 });
    let ownerAccess = false;
    try { ownerAccess = (await requireCloudBusinessContext()).businessId === String(asset.business_id); }
    catch { ownerAccess = false; }
    if (!ownerAccess) {
      if (!["page-logo", "page-cover", "portfolio"].includes(asset.kind)) return new NextResponse(null, { status: 404 });
      const { data: pageRow } = await admin.from("qai_space_pages").select("payload").eq("business_id", asset.business_id).not("published_at", "is", null).maybeSingle();
      if (!pageRow) return new NextResponse(null, { status: 404 });
      const page = qaiPageSchema.parse(pageRow.payload);
      const url = `/api/qai-space/media/${id}`;
      const published = asset.kind === "page-logo" ? page.logo === url : asset.kind === "page-cover" ? page.coverImage === url : page.portfolio.some((item) => item.visible && item.imageUrl === url);
      if (!published) return new NextResponse(null, { status: 404 });
    }
    const { data, error: downloadError } = await admin.storage.from("qai-space-media").download(asset.storage_path);
    if (downloadError || !data) throw downloadError;
    return new NextResponse(await data.arrayBuffer(), { headers: { "Content-Type": asset.mime_type, "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const business = await requireCloudBusinessContext();
    const { id } = await context.params;
    const admin = createCloudAdminClient();
    const { data: asset } = await admin.from("qai_space_media_assets").select("storage_path").eq("business_id", business.businessId).eq("id", id).maybeSingle();
    if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    await admin.storage.from("qai-space-media").remove([asset.storage_path]);
    await admin.from("qai_space_media_assets").delete().eq("business_id", business.businessId).eq("id", id);
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Could not remove that image." }, { status: 400 });
  }
}
