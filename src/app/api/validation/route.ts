import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { z } from "zod";

import { qaiPageSchema } from "@/features/qai-page/validation";
import { validateQuestionnaireResponses } from "@/features/booking-questionnaire/questionnaire";
import { publicRequestSchema, defaultQaiPage, snapshotPublicServiceSelection, type PublicRequest, type QaiPageConfig } from "@/features/qai-page/validation";
import { createValidationStoreRepository, ValidationStoreError, validationRequestInputSchema } from "@/features/qai-page/validationStore";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { createValidationAdminClient } from "@/lib/validation/admin";
import { requireValidationSession } from "@/lib/validation/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repository = createValidationStoreRepository(path.resolve(process.cwd(), ".qai-validation"));
const savePageAction = z.object({ action: z.literal("save-page"), page: qaiPageSchema });
const submitRequestAction = z.object({ action: z.literal("submit-request"), request: validationRequestInputSchema });
const updateRequestAction = z.object({ action: z.literal("update-request"), requestId: z.string().min(1).max(100), status: z.enum(["Pending", "Accepted", "Declined"]), bookingId: z.string().max(100).nullable(), clientId: z.string().max(100).nullable().default(null) });
const actionSchema = z.discriminatedUnion("action", [savePageAction, submitRequestAction, updateRequestAction]);

const MESSAGES: Record<string, string> = {
  SLUG_TAKEN: "This page address is already in use.", PAGE_NOT_FOUND: "This Qai Page is not available.", SERVICE_NOT_AVAILABLE: "This service is not available.",
  SCHEDULE_REQUIRED: "Add at least one preferred schedule.", SLOT_REQUIRED: "Choose an available time.", SLOT_TAKEN: "This time is no longer available. Choose another one.",
  REQUEST_NOT_FOUND: "This request could not be found.", REQUEST_DECLINED: "A declined request cannot be accepted.",
  QUESTIONNAIRE_INVALID: "Complete the required questions and try again.",
  SERVICE_VARIANT_REQUIRED: "Choose an available service option.",
};
function failure(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function GET(request: NextRequest) {
  if (isValidationModeEnabled()) return remoteGet(request);
  try {
    const scope = request.nextUrl.searchParams.get("scope"); const store = await repository.read();
    if (scope === "owner") return NextResponse.json({ data: store }, { headers: { "Cache-Control": "no-store" } });
    if (scope === "page") { const slug = request.nextUrl.searchParams.get("slug") ?? ""; const page = store.pages.find((item) => item.slug === slug); return page ? NextResponse.json({ data: page }, { headers: { "Cache-Control": "no-store" } }) : failure("This Qai Page is not available.", 404); }
    return failure("Unknown validation request.", 404);
  } catch { return failure("Validation data could not be loaded.", 500); }
}

export async function POST(request: NextRequest) {
  let input: z.infer<typeof actionSchema>;
  try { input = actionSchema.parse(await request.json()); } catch { return failure("Check the information and try again."); }
  if (isValidationModeEnabled()) return remotePost(input);
  try {
    const data = input.action === "save-page" ? await repository.savePage(input.page)
      : input.action === "submit-request" ? await repository.submitRequest(input.request)
        : await repository.updateRequest(input.requestId, input.status, input.bookingId, input.clientId);
    return NextResponse.json({ data });
  } catch (error) {
    const code = error instanceof ValidationStoreError ? error.code : "";
    return failure(MESSAGES[code] ?? "The validation request could not be completed.", code === "PAGE_NOT_FOUND" ? 404 : 409);
  }
}

async function remoteGet(request: NextRequest) {
  const admin = createValidationAdminClient();
  const scope = request.nextUrl.searchParams.get("scope");
  try {
    if (scope === "page") {
      const slug = request.nextUrl.searchParams.get("slug") ?? "";
      const { data } = await admin.from("validation_public_pages").select("payload").eq("slug", slug).maybeSingle();
      return data ? NextResponse.json({ data: qaiPageSchema.parse(data.payload) }, { headers: { "Cache-Control": "no-store" } }) : failure("This Qai Page is not available.", 404);
    }
    if (scope !== "owner") return failure("Unknown validation request.", 404);
    const session = await requireValidationSession();
    const [{ data: workspace }, { data: pageRow }, { data: requestRows }] = await Promise.all([
      admin.from("validation_workspaces").select("label, public_slug").eq("id", session.workspaceId).single(),
      admin.from("validation_public_pages").select("payload").eq("workspace_id", session.workspaceId).maybeSingle(),
      admin.from("validation_public_requests").select("payload").eq("workspace_id", session.workspaceId).order("created_at", { ascending: false }),
    ]);
    if (!workspace) throw new Error("Workspace unavailable.");
    const initial: QaiPageConfig = { ...defaultQaiPage(), id: `page-${workspace.public_slug}`, slug: workspace.public_slug, businessName: workspace.label };
    const page = pageRow ? qaiPageSchema.parse(pageRow.payload) : initial;
    const requests = (requestRows ?? []).map((row) => publicRequestSchema.parse(row.payload));
    return NextResponse.json({ data: { pages: [page], requests } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return failure("Validation data could not be loaded.", 401);
  }
}

async function remotePost(input: z.infer<typeof actionSchema>) {
  const admin = createValidationAdminClient();
  try {
    if (input.action === "save-page") {
      const session = await requireValidationSession();
      const page = qaiPageSchema.parse({ ...input.page, businessId: "local-business", updatedAt: Date.now() });
      const { error } = await admin.from("validation_public_pages").upsert({ workspace_id: session.workspaceId, slug: page.slug, payload: page, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
      if (error) throw new ValidationStoreError(error.code === "23505" ? "SLUG_TAKEN" : "SAVE_FAILED");
      return NextResponse.json({ data: page });
    }
    if (input.action === "update-request") {
      const session = await requireValidationSession();
      const { data: row } = await admin.from("validation_public_requests").select("payload").eq("workspace_id", session.workspaceId).eq("id", input.requestId).maybeSingle();
      if (!row) throw new ValidationStoreError("REQUEST_NOT_FOUND");
      const current = publicRequestSchema.parse(row.payload);
      if (current.status === "Declined" && input.status === "Accepted") throw new ValidationStoreError("REQUEST_DECLINED");
      const updated = publicRequestSchema.parse({ ...current, status: input.status, bookingId: input.bookingId, clientId: input.clientId ?? current.clientId, updatedAt: Date.now() });
      await admin.from("validation_public_requests").update({ payload: updated, updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId).eq("id", input.requestId);
      return NextResponse.json({ data: updated });
    }

    const { data: pageRow } = await admin.from("validation_public_pages").select("workspace_id, payload").eq("slug", input.request.slug).maybeSingle();
    if (!pageRow) throw new ValidationStoreError("PAGE_NOT_FOUND");
    const page = qaiPageSchema.parse(pageRow.payload);
    const service = page.services.find((item) => item.serviceId === input.request.serviceId && item.visible && item.actionMode === input.request.type);
    if (!service) throw new ValidationStoreError("SERVICE_NOT_AVAILABLE");
    const activeVariants = service.variants.filter((variant) => variant.active);
    if (activeVariants.length > 0 && !activeVariants.some((variant) => variant.id === input.request.serviceVariantId)) throw new ValidationStoreError("SERVICE_VARIANT_REQUIRED");
    if (Object.keys(validateQuestionnaireResponses(page.questionnaire, service.serviceId, input.request.questionnaireResponses, true)).length > 0) throw new ValidationStoreError("QUESTIONNAIRE_INVALID");
    const fileResponseIds = input.request.questionnaireResponses.flatMap((response) => {
      if (typeof response.answer !== "object" || Array.isArray(response.answer)) return [];
      const match = response.answer.url.match(/^\/api\/validation\/media\/([0-9a-f-]{36})$/i);
      return match ? [match[1]] : [];
    });
    const fileResponseCount = input.request.questionnaireResponses.filter((response) => typeof response.answer === "object" && !Array.isArray(response.answer)).length;
    if (fileResponseIds.length !== fileResponseCount) throw new ValidationStoreError("QUESTIONNAIRE_INVALID");
    if (fileResponseIds.length > 0) {
      const { data: assets } = await admin.from("validation_media_assets").select("id").eq("workspace_id", pageRow.workspace_id).eq("kind", "booking-response").in("id", fileResponseIds);
      if ((assets ?? []).length !== new Set(fileResponseIds).size) throw new ValidationStoreError("QUESTIONNAIRE_INVALID");
    }
    const serviceSnapshot = snapshotPublicServiceSelection(service, input.request.serviceVariantId);
    if (input.request.type === "Booking request" && input.request.schedules.length < serviceSnapshot.defaultSessionCount) throw new ValidationStoreError("SCHEDULE_REQUIRED");
    const id = crypto.randomUUID();
    let schedules = input.request.schedules;
    let status: PublicRequest["status"] = "Pending";
    let reservedPage: QaiPageConfig | null = null;
    if (input.request.type === "Instant booking") {
      const slotIndex = page.slots.findIndex((slot) => slot.id === input.request.instantSlotId && slot.serviceId === service.serviceId && slot.status === "Available");
      if (slotIndex < 0) throw new ValidationStoreError("SLOT_TAKEN");
      const slot = page.slots[slotIndex];
      const local = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: page.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
      const parts = (value: string) => { const values = local(value); const get = (type: Intl.DateTimeFormatPartTypes) => values.find((part) => part.type === type)?.value ?? ""; return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` }; };
      const start = parts(slot.startAt); const end = parts(slot.endAt);
      schedules = [{ id: crypto.randomUUID(), label: "", date: start.date, startTime: start.time, endTime: end.time, location: slot.location }];
      page.slots[slotIndex] = { ...slot, status: "Reserved", requestId: id };
      status = "Accepted";
      reservedPage = page;
    }
    const now = Date.now();
    const created = publicRequestSchema.parse({ ...input.request, id, pageId: page.id, serviceName: service.title, serviceSnapshot, clientId: null, schedules, status, submittedAt: now, updatedAt: now, bookingId: null });
    const idempotencyKey = input.request.submissionId;
    if (reservedPage) {
      const reservedSlot = reservedPage.slots.find((slot) => slot.id === input.request.instantSlotId);
      const { data: reserved, error: reserveError } = await admin.rpc("reserve_validation_instant_request", { target_workspace_id: pageRow.workspace_id, target_page_slug: page.slug, target_slot_id: input.request.instantSlotId, target_request_id: id, target_request_payload: created, target_reserved_slot: reservedSlot, target_idempotency_key: idempotencyKey }).maybeSingle();
      if (reserveError || !reserved) throw new ValidationStoreError("SLOT_TAKEN");
      return NextResponse.json({ data: publicRequestSchema.parse(reserved) });
    }
    const { data: inserted, error } = await admin.from("validation_public_requests").insert({ id, workspace_id: pageRow.workspace_id, page_slug: page.slug, payload: created, idempotency_key: idempotencyKey }).select("payload").maybeSingle();
    if (error?.code === "23505") {
      const { data: duplicate } = await admin.from("validation_public_requests").select("payload").eq("workspace_id", pageRow.workspace_id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (duplicate) return NextResponse.json({ data: publicRequestSchema.parse(duplicate.payload) });
    }
    if (error || !inserted) throw error;
    return NextResponse.json({ data: publicRequestSchema.parse(inserted.payload) });
  } catch (error) {
    const code = error instanceof ValidationStoreError ? error.code : "";
    return failure(MESSAGES[code] ?? "The validation request could not be completed.", code === "PAGE_NOT_FOUND" ? 404 : 409);
  }
}
