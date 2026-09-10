import { NextResponse } from "next/server";

import { createCloudAdminClient } from "@/lib/supabase/admin";
import { requireCloudBusinessContext } from "@/lib/supabase/cloudContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_MEDIA_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "Vary": "Cookie",
  "X-Content-Type-Options": "nosniff",
};

function privateNotFound() {
  return new NextResponse(null, { status: 404, headers: PRIVATE_MEDIA_HEADERS });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const business = await requireCloudBusinessContext();
    const { id } = await context.params;
    const admin = createCloudAdminClient();
    const { data: asset, error } = await admin.from("qai_space_media_assets")
      .select("business_id, storage_path, mime_type")
      .eq("id", id)
      .eq("business_id", business.businessId)
      .maybeSingle();
    if (error || !asset) return privateNotFound();
    const { data, error: downloadError } = await admin.storage.from("qai-space-media").download(asset.storage_path);
    if (downloadError || !data) throw downloadError;
    return new NextResponse(await data.arrayBuffer(), {
      headers: { ...PRIVATE_MEDIA_HEADERS, "Content-Type": asset.mime_type },
    });
  } catch {
    return privateNotFound();
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
