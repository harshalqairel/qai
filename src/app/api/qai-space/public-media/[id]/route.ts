import { NextResponse } from "next/server";

import { isPublishedQaiSpaceMedia, type QaiSpacePublicMediaKind } from "@/features/qai-page/cloudMedia";
import { qaiPageSchema } from "@/features/qai-page/validation";
import { createCloudAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_MEDIA_KINDS = new Set<QaiSpacePublicMediaKind>(["page-logo", "page-cover", "portfolio"]);
const PUBLIC_MEDIA_HEADERS = {
  "Cache-Control": "no-store, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Content-Type-Options": "nosniff",
};

function publicNotFound() {
  return new NextResponse(null, { status: 404, headers: PUBLIC_MEDIA_HEADERS });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const admin = createCloudAdminClient();
    const { data: asset, error } = await admin.from("qai_space_media_assets")
      .select("business_id, kind, storage_path, mime_type")
      .eq("id", id)
      .maybeSingle();
    if (error || !asset || !PUBLIC_MEDIA_KINDS.has(asset.kind as QaiSpacePublicMediaKind)) return publicNotFound();

    const { data: pageRow, error: pageError } = await admin.from("qai_space_pages")
      .select("payload")
      .eq("business_id", asset.business_id)
      .not("published_at", "is", null)
      .maybeSingle();
    if (pageError || !pageRow) return publicNotFound();
    const page = qaiPageSchema.parse(pageRow.payload);
    if (!isPublishedQaiSpaceMedia(page, { id, kind: asset.kind as QaiSpacePublicMediaKind })) return publicNotFound();

    const { data, error: downloadError } = await admin.storage.from("qai-space-media").download(asset.storage_path);
    if (downloadError || !data) throw downloadError;
    return new NextResponse(await data.arrayBuffer(), {
      headers: { ...PUBLIC_MEDIA_HEADERS, "Content-Type": asset.mime_type },
    });
  } catch {
    return publicNotFound();
  }
}
