import { NextResponse } from "next/server";

import { questionsForService } from "@/features/booking-questionnaire/questionnaire";
import { materializeCloudPage } from "@/features/qai-page/cloudMapping";
import { qaiPageSchema } from "@/features/qai-page/validation";
import { createCloudAdminClient } from "@/lib/supabase/admin";

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
    const admin = createCloudAdminClient();
    const { data: pageRow, error: pageError } = await admin.from("qai_space_pages").select("business_id, payload").eq("slug", slug).not("published_at", "is", null).maybeSingle();
    if (pageError) throw pageError;
    if (!pageRow) return NextResponse.json({ error: "This Space is not available." }, { status: 404 });
    const { data: serviceRows, error: serviceError } = await admin.from("services").select("*").eq("business_id", pageRow.business_id);
    if (serviceError) throw serviceError;
    const page = materializeCloudPage(qaiPageSchema.parse(pageRow.payload), Array.isArray(serviceRows) ? serviceRows : []);
    const service = page.services.find((item) => item.serviceId === serviceId && item.visible);
    const question = questionsForService(page.questionnaire, serviceId).find((item) => item.id === questionId && item.type === "File / image");
    if (!service || !question) return NextResponse.json({ error: "This upload field is not available." }, { status: 409 });

    const id = crypto.randomUUID();
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "application/pdf" ? "pdf" : "jpg";
    const storagePath = `${pageRow.business_id}/booking-response/${id}.${extension}`;
    const { error: uploadError } = await admin.storage.from("qai-space-media").upload(storagePath, await file.arrayBuffer(), { contentType: file.type, cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { error: recordError } = await admin.from("qai_space_media_assets").insert({ id, business_id: pageRow.business_id, kind: "booking-response", storage_path: storagePath, mime_type: file.type, size_bytes: file.size });
    if (recordError) {
      await admin.storage.from("qai-space-media").remove([storagePath]);
      throw recordError;
    }
    return NextResponse.json({ data: { id, url: `/api/qai-space/media/${id}` } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not upload that file." }, { status: 400 });
  }
}
