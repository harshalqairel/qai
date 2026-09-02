import { NextResponse } from "next/server";
import { z } from "zod";

import { createCloudAdminClient } from "@/lib/supabase/admin";
import { requireCloudBusinessContext } from "@/lib/supabase/cloudContext";

export const runtime = "nodejs";

const kindSchema = z.enum(["page-logo", "page-cover", "portfolio"]);
const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const context = await requireCloudBusinessContext();
    const form = await request.formData();
    const file = form.get("file");
    const kind = kindSchema.parse(form.get("kind"));
    if (!(file instanceof File) || !mimeTypes.has(file.type) || file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Use a PNG, JPG, or WebP image up to 8 MB." }, { status: 400 });
    }
    const admin = createCloudAdminClient();
    if (kind === "portfolio") {
      const { count, error } = await admin.from("qai_space_media_assets").select("id", { count: "exact", head: true }).eq("business_id", context.businessId).eq("kind", "portfolio");
      if (error) throw error;
      if ((count ?? 0) >= 40) return NextResponse.json({ error: "Portfolio is limited to 40 images." }, { status: 409 });
    }
    const id = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `${context.businessId}/${kind}/${id}.${extension}`;
    const { error: uploadError } = await admin.storage.from("qai-space-media").upload(storagePath, await file.arrayBuffer(), { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    const { error: recordError } = await admin.from("qai_space_media_assets").insert({ id, business_id: context.businessId, kind, storage_path: storagePath, mime_type: file.type, size_bytes: file.size });
    if (recordError) {
      await admin.storage.from("qai-space-media").remove([storagePath]);
      throw recordError;
    }
    return NextResponse.json({ data: { id, url: `/api/qai-space/media/${id}` } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not upload that image." }, { status: 400 });
  }
}
