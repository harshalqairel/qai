import { NextResponse } from "next/server";
import { z } from "zod";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { requireValidationSession } from "@/lib/validation/session";

export const runtime = "nodejs";

const kindSchema = z.enum(["page-logo", "page-cover", "portfolio", "invoice-logo", "invoice-signature", "invoice-stamp", "invoice-watermark", "booking-response"]);
const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const bookingResponseMimeTypes = new Set([...mimeTypes, "application/pdf"]);

export async function POST(request: Request) {
  try {
    const session = await requireValidationSession();
    const form = await request.formData();
    const file = form.get("file");
    const kind = kindSchema.parse(form.get("kind"));
    const allowedMimeTypes = kind === "booking-response" ? bookingResponseMimeTypes : mimeTypes;
    if (!(file instanceof File) || !allowedMimeTypes.has(file.type) || file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: kind === "booking-response" ? "Use a PNG, JPG, WebP, or PDF file up to 8 MB." : "Use a PNG, JPG, or WebP image up to 8 MB." }, { status: 400 });
    }
    const admin = createValidationAdminClient();
    if (kind === "portfolio") {
      const { count } = await admin.from("validation_media_assets").select("id", { count: "exact", head: true }).eq("workspace_id", session.workspaceId).eq("kind", "portfolio");
      if ((count ?? 0) >= 12) return NextResponse.json({ error: "Portfolio is limited to 12 images for validation." }, { status: 409 });
    }
    const id = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "application/pdf" ? "pdf" : "jpg";
    const storagePath = `${session.workspaceId}/${kind}/${id}.${extension}`;
    const bytes = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage.from("validation-media").upload(storagePath, bytes, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    const { error: recordError } = await admin.from("validation_media_assets").insert({ id, workspace_id: session.workspaceId, kind, storage_path: storagePath, mime_type: file.type, size_bytes: file.size });
    if (recordError) { await admin.storage.from("validation-media").remove([storagePath]); throw recordError; }
    return NextResponse.json({ data: { id, url: `/api/validation/media/${id}` } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not upload that image." }, { status: 400 });
  }
}
