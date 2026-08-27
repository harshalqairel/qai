import { NextResponse } from "next/server";

import { questionsForService } from "@/features/booking-questionnaire/questionnaire";
import { qaiPageSchema } from "@/features/qai-page/validation";
import { createValidationAdminClient } from "@/lib/validation/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const mimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const slug = String(form.get("slug") ?? "");
    const serviceId = String(form.get("serviceId") ?? "");
    const questionId = String(form.get("questionId") ?? "");
    if (!(file instanceof File) || !mimeTypes.has(file.type) || file.size <= 0 || file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Use a PNG, JPG, WebP, or PDF file up to 8 MB." }, { status: 400 });
    }

    const admin = createValidationAdminClient();
    const { data: pageRow } = await admin.from("validation_public_pages").select("workspace_id, payload").eq("slug", slug).maybeSingle();
    if (!pageRow) return NextResponse.json({ error: "This Space is not available." }, { status: 404 });
    const page = qaiPageSchema.parse(pageRow.payload);
    const service = page.services.find((item) => item.serviceId === serviceId && item.visible);
    const question = questionsForService(page.questionnaire, serviceId).find((item) => item.id === questionId && item.type === "File / image");
    if (!service || !question) return NextResponse.json({ error: "This upload field is not available." }, { status: 409 });

    const id = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "application/pdf" ? "pdf" : "jpg";
    const storagePath = `${pageRow.workspace_id}/booking-response/${id}.${extension}`;
    const { error: uploadError } = await admin.storage.from("validation-media").upload(storagePath, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { error: recordError } = await admin.from("validation_media_assets").insert({ id, workspace_id: pageRow.workspace_id, kind: "booking-response", storage_path: storagePath, mime_type: file.type, size_bytes: file.size });
    if (recordError) {
      await admin.storage.from("validation-media").remove([storagePath]);
      throw recordError;
    }
    return NextResponse.json({ data: { id, url: `/api/validation/media/${id}` } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not upload that file." }, { status: 400 });
  }
}
