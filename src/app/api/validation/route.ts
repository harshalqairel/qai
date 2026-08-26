import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { z } from "zod";

import { qaiPageSchema } from "@/features/qai-page/validation";
import { bookingRecordSchema } from "@/features/booking/schema";
import type { Booking } from "@/features/booking/types";
import { validateQuestionnaireResponses } from "@/features/booking-questionnaire/questionnaire";
import { publicRequestSchema, defaultQaiPage, snapshotPublicServiceSelection, type PublicRequest, type QaiPageConfig } from "@/features/qai-page/validation";
import { createValidationStoreRepository, ValidationStoreError, validationRequestInputSchema } from "@/features/qai-page/validationStore";
import { availableServiceSlotsForDate, bookingCapacitySourceRequestIds, directBookingSlotCounts } from "@/features/qai-page/serviceCapacity";
import { findServiceSlot, normalizeServiceAvailability } from "@/features/service/domain/serviceAvailability";
import { serviceRecordSchema } from "@/features/service/schema";
import { mergePublicServices } from "@/features/qai-page/publicServiceSync";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { createValidationAdminClient } from "@/lib/validation/admin";
import { requireValidationSession } from "@/lib/validation/session";
import { sendValidationWorkspacePush } from "@/features/notifications/webPushServer";
import {
  LOCAL_VALIDATION_BACKEND_CAPABILITIES,
  isMissingCapabilityRpc,
  loadValidationBackendCapabilities,
} from "@/features/qai-page/backendCapabilities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repository = createValidationStoreRepository(path.resolve(process.cwd(), ".qai-validation"));
const savePageAction = z.object({ action: z.literal("save-page"), page: qaiPageSchema });
const submitRequestAction = z.object({ action: z.literal("submit-request"), request: validationRequestInputSchema });
const updateRequestAction = z.object({ action: z.literal("update-request"), requestId: z.string().min(1).max(100), status: z.enum(["Pending", "Accepted", "Declined"]), bookingId: z.string().max(100).nullable(), clientId: z.string().max(100).nullable().default(null) });
const claimRequestAction = z.object({ action: z.literal("claim-request"), requestId: z.string().uuid() });
const actionSchema = z.discriminatedUnion("action", [savePageAction, submitRequestAction, updateRequestAction, claimRequestAction]);

const MESSAGES: Record<string, string> = {
  SLUG_TAKEN: "This page address is already in use.", PAGE_NOT_FOUND: "This Qai Page is not available.", SERVICE_NOT_AVAILABLE: "This service is not available.",
  SCHEDULE_REQUIRED: "Add at least one preferred schedule.", SLOT_REQUIRED: "Choose an available time.", SLOT_TAKEN: "This time is no longer available. Choose another one.",
  REQUEST_NOT_FOUND: "This request could not be found.", REQUEST_DECLINED: "A declined request cannot be accepted.",
  QUESTIONNAIRE_INVALID: "Complete the required questions and try again.",
  SERVICE_VARIANT_REQUIRED: "Choose an available service option.",
  SESSION_FULL: "That time is full. Choose another available time.",
  SCHEDULE_NOT_AVAILABLE: "Choose one of the available service times.",
  CAPACITY_CLAIM_REQUIRED: "Accept this request through the capacity-checked action.",
  CAPACITY_BACKEND_UNAVAILABLE: "Capacity checking is not ready in this workspace. Apply the pending validation migration before accepting this scheduled service.",
  CAPACITY_BACKEND_FAILED: "Booking availability could not be checked. Refresh and try again.",
};
function failure(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

function bookingsFromDocument(value: unknown): Booking[] {
  const parsed = z.object({ data: z.array(bookingRecordSchema) }).safeParse(value);
  return parsed.success ? parsed.data.data : [];
}

function servicesFromDocument(value: unknown) {
  const parsed = z.object({ data: z.array(serviceRecordSchema) }).safeParse(value);
  return parsed.success ? parsed.data.data : null;
}

function materializePageServices(page: QaiPageConfig, serviceDocument: unknown, includeInactive = false): QaiPageConfig {
  const operational = servicesFromDocument(serviceDocument);
  return operational
    ? { ...page, services: mergePublicServices(page.services, operational, { includeInactive }) }
    : page;
}

function validatedAvailabilityKeys(input: {
  page: QaiPageConfig;
  service: QaiPageConfig["services"][number];
  request: z.infer<typeof validationRequestInputSchema>;
  requests: PublicRequest[];
  bookings?: Booking[];
}): string[] {
  if (input.request.type !== "Booking request" || normalizeServiceAvailability(input.service.availability).mode === "Flexible") return [];
  if (input.request.schedules.length === 0) throw new ValidationStoreError("SCHEDULE_REQUIRED");
  return input.request.schedules.map((schedule) => {
    const slots = availableServiceSlotsForDate({ service: input.service, variantId: input.request.serviceVariantId, date: schedule.date, timezone: input.page.timezone, requests: input.requests, bookings: input.bookings });
    const slot = slots.find((candidate) => candidate.startTime === schedule.startTime);
    if (!slot) throw new ValidationStoreError("SCHEDULE_NOT_AVAILABLE");
    if (slot.full) throw new ValidationStoreError("SESSION_FULL");
    if (schedule.endTime !== slot.endTime) throw new ValidationStoreError("SCHEDULE_NOT_AVAILABLE");
    return slot.key;
  });
}

export async function GET(request: NextRequest) {
  if (isValidationModeEnabled()) return remoteGet(request);
  try {
    const scope = request.nextUrl.searchParams.get("scope"); const store = await repository.read();
    if (scope === "owner") return NextResponse.json({ data: { ...store, capabilities: LOCAL_VALIDATION_BACKEND_CAPABILITIES } }, { headers: { "Cache-Control": "no-store" } });
    if (scope === "page") { const slug = request.nextUrl.searchParams.get("slug") ?? ""; const page = store.pages.find((item) => item.slug === slug); return page ? NextResponse.json({ data: page }, { headers: { "Cache-Control": "no-store" } }) : failure("This Qai Page is not available.", 404); }
    if (scope === "availability") { const slug = request.nextUrl.searchParams.get("slug") ?? ""; const serviceId = request.nextUrl.searchParams.get("serviceId") ?? ""; const date = request.nextUrl.searchParams.get("date") ?? ""; const variantId = request.nextUrl.searchParams.get("variantId"); const page = store.pages.find((item) => item.slug === slug); const service = page?.services.find((item) => item.serviceId === serviceId && item.visible); if (!page || !service || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return failure("Availability could not be loaded.", 404); return NextResponse.json({ data: availableServiceSlotsForDate({ service, variantId, date, timezone: page.timezone, requests: store.requests }) }, { headers: { "Cache-Control": "no-store" } }); }
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
        : input.action === "claim-request" ? await repository.claimRequest(input.requestId)
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
      const { data } = await admin.from("validation_public_pages").select("workspace_id, payload").eq("slug", slug).maybeSingle();
      if (!data) return failure("This Qai Page is not available.", 404);
      const { data: serviceDocument } = await admin.from("validation_workspace_documents").select("value").eq("workspace_id", data.workspace_id).eq("storage_key", "qai:services").maybeSingle();
      const page = materializePageServices(qaiPageSchema.parse(data.payload), serviceDocument?.value);
      return NextResponse.json({ data: page }, { headers: { "Cache-Control": "no-store" } });
    }
    if (scope === "availability") {
      const slug = request.nextUrl.searchParams.get("slug") ?? ""; const serviceId = request.nextUrl.searchParams.get("serviceId") ?? ""; const date = request.nextUrl.searchParams.get("date") ?? ""; const variantId = request.nextUrl.searchParams.get("variantId");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return failure("Availability could not be loaded.", 400);
      const { data: pageRow } = await admin.from("validation_public_pages").select("workspace_id, payload").eq("slug", slug).maybeSingle();
      if (!pageRow) return failure("This Qai Page is not available.", 404);
      const [{ data: rows }, { data: bookingDocument }, { data: serviceDocument }] = await Promise.all([
        admin.from("validation_public_requests").select("payload").eq("workspace_id", pageRow.workspace_id),
        admin.from("validation_workspace_documents").select("value").eq("workspace_id", pageRow.workspace_id).eq("storage_key", "qai:bookings").maybeSingle(),
        admin.from("validation_workspace_documents").select("value").eq("workspace_id", pageRow.workspace_id).eq("storage_key", "qai:services").maybeSingle(),
      ]);
      const page = materializePageServices(qaiPageSchema.parse(pageRow.payload), serviceDocument?.value);
      const service = page.services.find((item) => item.serviceId === serviceId && item.visible);
      if (!service) return failure("This service is not available.", 404);
      const requests = (rows ?? []).map((row) => publicRequestSchema.parse(row.payload));
      return NextResponse.json({ data: availableServiceSlotsForDate({ service, variantId, date, timezone: page.timezone, requests, bookings: bookingsFromDocument(bookingDocument?.value) }) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (scope !== "owner") return failure("Unknown validation request.", 404);
    const session = await requireValidationSession();
    const capabilities = await loadValidationBackendCapabilities(admin);
    const [{ data: workspace }, { data: pageRow }, { data: requestRows }, { data: serviceDocument }] = await Promise.all([
      admin.from("validation_workspaces").select("label, public_slug").eq("id", session.workspaceId).single(),
      admin.from("validation_public_pages").select("payload").eq("workspace_id", session.workspaceId).maybeSingle(),
      admin.from("validation_public_requests").select("payload").eq("workspace_id", session.workspaceId).order("created_at", { ascending: false }),
      admin.from("validation_workspace_documents").select("value").eq("workspace_id", session.workspaceId).eq("storage_key", "qai:services").maybeSingle(),
    ]);
    if (!workspace) throw new Error("Workspace unavailable.");
    const initial: QaiPageConfig = { ...defaultQaiPage(), id: `page-${workspace.public_slug}`, slug: workspace.public_slug, businessName: workspace.label };
    const page = materializePageServices(pageRow ? qaiPageSchema.parse(pageRow.payload) : initial, serviceDocument?.value, true);
    const requests = (requestRows ?? []).map((row) => publicRequestSchema.parse(row.payload));
    return NextResponse.json({ data: { pages: [page], requests, capabilities } }, { headers: { "Cache-Control": "no-store" } });
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
    if (input.action === "claim-request") {
      const session = await requireValidationSession();
      const [{ data: row }, { data: pageRow }, { data: bookingDocument }, { data: serviceDocument }] = await Promise.all([
        admin.from("validation_public_requests").select("payload").eq("workspace_id", session.workspaceId).eq("id", input.requestId).maybeSingle(),
        admin.from("validation_public_pages").select("payload").eq("workspace_id", session.workspaceId).maybeSingle(),
        admin.from("validation_workspace_documents").select("value").eq("workspace_id", session.workspaceId).eq("storage_key", "qai:bookings").maybeSingle(),
        admin.from("validation_workspace_documents").select("value").eq("workspace_id", session.workspaceId).eq("storage_key", "qai:services").maybeSingle(),
      ]);
      if (!row) throw new ValidationStoreError("REQUEST_NOT_FOUND");
      const current = publicRequestSchema.parse(row.payload);
      if (current.status === "Accepted") return NextResponse.json({ data: current });
      if (current.status === "Declined") throw new ValidationStoreError("REQUEST_DECLINED");
      if (!pageRow) throw new ValidationStoreError("PAGE_NOT_FOUND");
      const page = materializePageServices(qaiPageSchema.parse(pageRow.payload), serviceDocument?.value);
      const service = page.services.find((candidate) => candidate.serviceId === current.serviceId);
      if (!service) throw new ValidationStoreError("SERVICE_NOT_AVAILABLE");
      const bookings = bookingsFromDocument(bookingDocument?.value);
      const directCounts = directBookingSlotCounts(service, bookings, page.timezone);
      const replacedRequestIds = bookingCapacitySourceRequestIds(bookings);
      const snapshot = current.serviceSnapshot ?? snapshotPublicServiceSelection(service, current.serviceVariantId);
      const targetSlots = current.type === "Booking request" && normalizeServiceAvailability(service.availability).mode !== "Flexible" ? current.schedules.map((schedule) => {
        const slot = findServiceSlot(service.serviceId, service.availability, schedule.date, schedule.startTime, snapshot.duration, page.timezone);
        if (!slot || slot.endTime !== schedule.endTime) throw new ValidationStoreError("SCHEDULE_NOT_AVAILABLE");
        return { serviceId: service.serviceId, key: slot.key, date: slot.date, startTime: slot.startTime, capacity: slot.capacity, manualBlocked: slot.manualBlocked, existingBookings: directCounts.get(slot.key) ?? 0, replacedRequestIds };
      }) : [];
      if (targetSlots.length === 0) {
        const claimed = publicRequestSchema.parse({ ...current, status: "Accepted", updatedAt: Date.now() });
        const { data: updatedRow, error } = await admin.from("validation_public_requests").update({ payload: claimed, updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId).eq("id", input.requestId).select("id").maybeSingle();
        if (error || !updatedRow) throw new ValidationStoreError("REQUEST_NOT_FOUND");
        return NextResponse.json({ data: claimed });
      }
      const { data: claimed, error } = await admin.rpc("claim_validation_request_capacity", { target_workspace_id: session.workspaceId, target_request_id: input.requestId, target_slots: targetSlots }).maybeSingle();
      if (error) {
        if (error.message.includes("SESSION_FULL")) throw new ValidationStoreError("SESSION_FULL");
        if (error.message.includes("REQUEST_NOT_FOUND")) throw new ValidationStoreError("REQUEST_NOT_FOUND");
        console.error("[QAI_VALIDATION] managed capacity claim failed", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        throw new ValidationStoreError(isMissingCapabilityRpc(error) ? "CAPACITY_BACKEND_UNAVAILABLE" : "CAPACITY_BACKEND_FAILED");
      }
      return NextResponse.json({ data: publicRequestSchema.parse(claimed) });
    }
    if (input.action === "update-request") {
      const session = await requireValidationSession();
      const { data: row } = await admin.from("validation_public_requests").select("payload").eq("workspace_id", session.workspaceId).eq("id", input.requestId).maybeSingle();
      if (!row) throw new ValidationStoreError("REQUEST_NOT_FOUND");
      const current = publicRequestSchema.parse(row.payload);
      if (current.status === "Declined" && input.status === "Accepted") throw new ValidationStoreError("REQUEST_DECLINED");
      if (current.status !== "Accepted" && input.status === "Accepted") throw new ValidationStoreError("CAPACITY_CLAIM_REQUIRED");
      const updated = publicRequestSchema.parse({ ...current, status: input.status, bookingId: input.bookingId, clientId: input.clientId ?? current.clientId, updatedAt: Date.now() });
      const { data: updatedRow, error } = await admin.from("validation_public_requests").update({ payload: updated, updated_at: new Date().toISOString() }).eq("workspace_id", session.workspaceId).eq("id", input.requestId).select("id").maybeSingle();
      if (error || !updatedRow) throw new ValidationStoreError("REQUEST_NOT_FOUND");
      return NextResponse.json({ data: updated });
    }

    const { data: pageRow } = await admin.from("validation_public_pages").select("workspace_id, payload").eq("slug", input.request.slug).maybeSingle();
    if (!pageRow) throw new ValidationStoreError("PAGE_NOT_FOUND");
    const { data: serviceDocument } = await admin.from("validation_workspace_documents").select("value").eq("workspace_id", pageRow.workspace_id).eq("storage_key", "qai:services").maybeSingle();
    const page = materializePageServices(qaiPageSchema.parse(pageRow.payload), serviceDocument?.value);
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
    const [{ data: capacityRows }, { data: bookingDocument }] = normalizeServiceAvailability(service.availability).mode === "Flexible" || input.request.type !== "Booking request" ? [{ data: [] }, { data: null }] : await Promise.all([
      admin.from("validation_public_requests").select("payload").eq("workspace_id", pageRow.workspace_id),
      admin.from("validation_workspace_documents").select("value").eq("workspace_id", pageRow.workspace_id).eq("storage_key", "qai:bookings").maybeSingle(),
    ]);
    const capacityRequests = (capacityRows ?? []).map((row) => publicRequestSchema.parse(row.payload));
    const availabilityKeys = validatedAvailabilityKeys({ page, service, request: input.request, requests: capacityRequests, bookings: bookingsFromDocument(bookingDocument?.value) });
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
    const created = publicRequestSchema.parse({ ...input.request, id, pageId: page.id, serviceName: service.title, serviceSnapshot, clientId: null, schedules, availabilityKeys, availabilityKey: availabilityKeys[0] ?? null, status, submittedAt: now, updatedAt: now, bookingId: null });
    const idempotencyKey = input.request.submissionId;
    if (reservedPage) {
      const reservedSlot = reservedPage.slots.find((slot) => slot.id === input.request.instantSlotId);
      const { data: reserved, error: reserveError } = await admin.rpc("reserve_validation_instant_request", { target_workspace_id: pageRow.workspace_id, target_page_slug: page.slug, target_slot_id: input.request.instantSlotId, target_request_id: id, target_request_payload: created, target_reserved_slot: reservedSlot, target_idempotency_key: idempotencyKey }).maybeSingle();
      if (reserveError || !reserved) throw new ValidationStoreError("SLOT_TAKEN");
      const parsedReserved = publicRequestSchema.parse(reserved);
      await sendValidationWorkspacePush(pageRow.workspace_id, "bookingRequests", { title: "New instant booking", body: `${parsedReserved.clientName} booked ${parsedReserved.serviceName}.`, url: "/qai-page?tab=Requests", tag: `qai-request-${parsedReserved.id}` }).catch(() => undefined);
      return NextResponse.json({ data: parsedReserved });
    }
    const { data: inserted, error } = await admin.from("validation_public_requests").insert({ id, workspace_id: pageRow.workspace_id, page_slug: page.slug, payload: created, idempotency_key: idempotencyKey }).select("payload").maybeSingle();
    if (error?.code === "23505") {
      const { data: duplicate } = await admin.from("validation_public_requests").select("payload").eq("workspace_id", pageRow.workspace_id).eq("idempotency_key", idempotencyKey).maybeSingle();
      if (duplicate) return NextResponse.json({ data: publicRequestSchema.parse(duplicate.payload) });
    }
    if (error || !inserted) throw error;
    const parsedInserted = publicRequestSchema.parse(inserted.payload);
    await sendValidationWorkspacePush(pageRow.workspace_id, "bookingRequests", { title: parsedInserted.type === "Inquiry" ? "New service inquiry" : "New booking request", body: `${parsedInserted.clientName} asked about ${parsedInserted.serviceName}.`, url: "/qai-page?tab=Requests", tag: `qai-request-${parsedInserted.id}` }).catch(() => undefined);
    return NextResponse.json({ data: parsedInserted });
  } catch (error) {
    const code = error instanceof ValidationStoreError ? error.code : "";
    return failure(MESSAGES[code] ?? "The validation request could not be completed.", code === "PAGE_NOT_FOUND" ? 404 : 409);
  }
}
