import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { validateQuestionnaireResponses } from "@/features/booking-questionnaire/questionnaire";
import { LOCAL_VALIDATION_BACKEND_CAPABILITIES } from "@/features/qai-page/backendCapabilities";
import { cloudBookingsForCapacity, materializeCloudPage } from "@/features/qai-page/cloudMapping";
import { availableServiceSlotsForDate } from "@/features/qai-page/serviceCapacity";
import {
  defaultQaiPage,
  normalizeSlug,
  publicRequestSchema,
  qaiPageSchema,
  snapshotPublicServiceSelection,
  type PublicRequest,
  type QaiPageConfig,
} from "@/features/qai-page/validation";
import { ValidationStoreError, validationRequestInputSchema } from "@/features/qai-page/validationStore";
import { findServiceSlot, normalizeServiceAvailability } from "@/features/service/domain/serviceAvailability";
import { sendCloudBusinessPush } from "@/features/notifications/webPushServer";
import { createCloudAdminClient, logCloudFailure } from "@/lib/supabase/admin";
import { requireCloudBusinessContext } from "@/lib/supabase/cloudContext";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const savePageAction = z.object({ action: z.literal("save-page"), page: qaiPageSchema });
const submitRequestAction = z.object({ action: z.literal("submit-request"), request: validationRequestInputSchema });
const updateRequestAction = z.object({ action: z.literal("update-request"), requestId: z.string().uuid(), status: z.enum(["Pending", "Accepted", "Declined"]), bookingId: z.string().uuid().nullable(), clientId: z.string().uuid().nullable().default(null) });
const claimRequestAction = z.object({ action: z.literal("claim-request"), requestId: z.string().uuid() });
const actionSchema = z.discriminatedUnion("action", [savePageAction, submitRequestAction, updateRequestAction, claimRequestAction]);

const MESSAGES: Record<string, string> = {
  SLUG_TAKEN: "This Space address is already in use.",
  PAGE_NOT_FOUND: "This Space is not available.",
  SERVICE_NOT_AVAILABLE: "This service is not available.",
  SCHEDULE_REQUIRED: "Add at least one preferred schedule.",
  SLOT_REQUIRED: "Choose an available time.",
  SLOT_TAKEN: "This time is no longer available. Choose another one.",
  REQUEST_NOT_FOUND: "This request could not be found.",
  REQUEST_DECLINED: "A declined request cannot be accepted.",
  QUESTIONNAIRE_INVALID: "Complete the required questions and try again.",
  SERVICE_VARIANT_REQUIRED: "Choose an available service option.",
  SESSION_FULL: "That time is full. Choose another available time.",
  SCHEDULE_NOT_AVAILABLE: "Choose one of the available service times.",
  CAPACITY_CLAIM_REQUIRED: "Accept this booking through the capacity-checked action.",
};

function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

function requestRows(value: unknown): PublicRequest[] {
  return rows(value).map((row) => publicRequestSchema.parse(row.payload));
}

function localSchedulePart(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

async function publicPageBySlug(slug: string) {
  const admin = createCloudAdminClient();
  const { data: pageRow, error } = await admin.from("qai_space_pages").select("id, business_id, payload").eq("slug", slug).not("published_at", "is", null).maybeSingle();
  if (error) throw error;
  if (!pageRow) throw new ValidationStoreError("PAGE_NOT_FOUND");
  const { data: serviceRows, error: serviceError } = await admin.from("services").select("*").eq("business_id", pageRow.business_id);
  if (serviceError) throw serviceError;
  return {
    admin,
    pageRow,
    page: materializeCloudPage(qaiPageSchema.parse(pageRow.payload), rows(serviceRows)),
  };
}

async function capacityDocuments(admin: ReturnType<typeof createCloudAdminClient>, businessId: string) {
  const [requestResult, bookingResult, sessionResult] = await Promise.all([
    admin.from("qai_space_requests").select("payload").eq("business_id", businessId),
    admin.from("bookings").select("*").eq("business_id", businessId),
    admin.from("booking_sessions").select("*").eq("business_id", businessId),
  ]);
  if (requestResult.error) throw requestResult.error;
  if (bookingResult.error) throw bookingResult.error;
  if (sessionResult.error) throw sessionResult.error;
  return {
    requests: requestRows(requestResult.data),
    bookings: cloudBookingsForCapacity(rows(bookingResult.data), rows(sessionResult.data)),
  };
}

function validateAvailabilityKeys(input: {
  page: QaiPageConfig;
  request: z.infer<typeof validationRequestInputSchema>;
  requests: PublicRequest[];
  bookings: ReturnType<typeof cloudBookingsForCapacity>;
}): string[] {
  const service = input.page.services.find((item) => item.serviceId === input.request.serviceId && item.visible);
  if (!service) throw new ValidationStoreError("SERVICE_NOT_AVAILABLE");
  if (input.request.type !== "Booking request" || normalizeServiceAvailability(service.availability).mode === "Flexible") return [];
  if (input.request.schedules.length === 0) throw new ValidationStoreError("SCHEDULE_REQUIRED");
  return input.request.schedules.map((schedule) => {
    const slot = availableServiceSlotsForDate({ service, variantId: input.request.serviceVariantId, date: schedule.date, timezone: input.page.timezone, requests: input.requests, bookings: input.bookings })
      .find((candidate) => candidate.startTime === schedule.startTime && candidate.endTime === schedule.endTime);
    if (!slot) throw new ValidationStoreError("SCHEDULE_NOT_AVAILABLE");
    if (slot.full) throw new ValidationStoreError("SESSION_FULL");
    return slot.key;
  });
}

export async function GET(request: NextRequest) {
  const scope = request.nextUrl.searchParams.get("scope");
  try {
    if (scope === "page") {
      const { page } = await publicPageBySlug(request.nextUrl.searchParams.get("slug") ?? "");
      return NextResponse.json({ data: page }, { headers: { "Cache-Control": "no-store" } });
    }
    if (scope === "availability") {
      const slug = request.nextUrl.searchParams.get("slug") ?? "";
      const serviceId = request.nextUrl.searchParams.get("serviceId") ?? "";
      const date = request.nextUrl.searchParams.get("date") ?? "";
      const variantId = request.nextUrl.searchParams.get("variantId");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return failure("Availability could not be loaded.", 400);
      const { admin, pageRow, page } = await publicPageBySlug(slug);
      const service = page.services.find((item) => item.serviceId === serviceId && item.visible);
      if (!service) throw new ValidationStoreError("SERVICE_NOT_AVAILABLE");
      const capacity = await capacityDocuments(admin, String(pageRow.business_id));
      const data = availableServiceSlotsForDate({ service, variantId, date, timezone: page.timezone, ...capacity });
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    }
    if (scope !== "owner") return failure("Unknown Qai Space request.", 404);

    const context = await requireCloudBusinessContext();
    const [pageResult, requestResult, serviceResult] = await Promise.all([
      context.client.from("qai_space_pages").select("id, payload").eq("business_id", context.businessId).maybeSingle(),
      context.client.from("qai_space_requests").select("payload").eq("business_id", context.businessId).order("created_at", { ascending: false }),
      context.client.from("services").select("*").eq("business_id", context.businessId),
    ]);
    if (pageResult.error) throw pageResult.error;
    if (requestResult.error) throw requestResult.error;
    if (serviceResult.error) throw serviceResult.error;
    const initial = qaiPageSchema.parse({
      ...defaultQaiPage(),
      id: crypto.randomUUID(),
      businessId: context.businessId,
      slug: normalizeSlug(context.businessName) || `business-${context.businessId.slice(0, 8)}`,
      businessName: context.businessName,
      timezone: context.timezone,
    });
    const stored = pageResult.data ? qaiPageSchema.parse(pageResult.data.payload) : initial;
    const page = materializeCloudPage(stored, rows(serviceResult.data), true);
    return NextResponse.json({ data: { pages: [page], requests: requestRows(requestResult.data), capabilities: LOCAL_VALIDATION_BACKEND_CAPABILITIES } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = error instanceof ValidationStoreError ? error.code : error instanceof Error ? error.message : "";
    if (!MESSAGES[code]) logCloudFailure(`GET ${scope ?? "unknown"}`, error);
    return failure(MESSAGES[code] ?? (code === "AUTH_REQUIRED" ? "Sign in to manage this Qai Space." : "Qai Space data could not be loaded."), code === "PAGE_NOT_FOUND" ? 404 : code === "AUTH_REQUIRED" ? 401 : 500);
  }
}

export async function POST(request: NextRequest) {
  let input: z.infer<typeof actionSchema>;
  try { input = actionSchema.parse(await request.json()); }
  catch { return failure("Check the information and try again."); }

  try {
    if (input.action === "save-page") return await savePage(input.page);
    if (input.action === "submit-request") return await submitRequest(input.request);
    if (input.action === "claim-request") return await claimRequest(input.requestId);
    return await updateRequest(input);
  } catch (error) {
    const code = error instanceof ValidationStoreError ? error.code : error instanceof Error ? error.message : "";
    const databaseCode = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    const resolvedCode = databaseCode === "23505" ? "SLUG_TAKEN" : code;
    if (!MESSAGES[resolvedCode]) logCloudFailure(`POST ${input.action}`, error);
    return failure(MESSAGES[resolvedCode] ?? "The Qai Space change could not be completed.", resolvedCode === "PAGE_NOT_FOUND" ? 404 : resolvedCode === "AUTH_REQUIRED" ? 401 : 409);
  }
}

async function savePage(input: QaiPageConfig) {
  const context = await requireCloudBusinessContext();
  const { data: current, error: loadError } = await context.client.from("qai_space_pages").select("id").eq("business_id", context.businessId).maybeSingle();
  if (loadError) throw loadError;
  const id = current?.id ? String(current.id) : crypto.randomUUID();
  const page = qaiPageSchema.parse({ ...input, id, businessId: context.businessId, updatedAt: Date.now() });
  const { error } = await context.client.from("qai_space_pages").upsert({
    id,
    business_id: context.businessId,
    slug: page.slug,
    payload: page,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "business_id" });
  if (error) throw error;
  return NextResponse.json({ data: page });
}

async function submitRequest(input: z.infer<typeof validationRequestInputSchema>) {
  const { admin, pageRow, page } = await publicPageBySlug(input.slug);
  const businessId = String(pageRow.business_id);
  const service = page.services.find((item) => item.serviceId === input.serviceId && item.visible && item.actionMode === input.type);
  if (!service) throw new ValidationStoreError("SERVICE_NOT_AVAILABLE");
  const activeVariants = service.variants.filter((variant) => variant.active);
  if (activeVariants.length > 0 && !activeVariants.some((variant) => variant.id === input.serviceVariantId)) throw new ValidationStoreError("SERVICE_VARIANT_REQUIRED");
  if (Object.keys(validateQuestionnaireResponses(page.questionnaire, service.serviceId, input.questionnaireResponses, true)).length > 0) throw new ValidationStoreError("QUESTIONNAIRE_INVALID");
  const fileIds = input.questionnaireResponses.flatMap((response) => {
    if (typeof response.answer !== "object" || Array.isArray(response.answer)) return [];
    const match = response.answer.url.match(/^\/api\/qai-space\/media\/([0-9a-f-]{36})$/i);
    return match ? [match[1]] : [];
  });
  const fileCount = input.questionnaireResponses.filter((response) => typeof response.answer === "object" && !Array.isArray(response.answer)).length;
  if (fileIds.length !== fileCount) throw new ValidationStoreError("QUESTIONNAIRE_INVALID");
  if (fileIds.length) {
    const { data: assets, error } = await admin.from("qai_space_media_assets").select("id").eq("business_id", businessId).eq("kind", "booking-response").in("id", fileIds);
    if (error) throw error;
    if ((assets ?? []).length !== new Set(fileIds).size) throw new ValidationStoreError("QUESTIONNAIRE_INVALID");
  }
  const snapshot = snapshotPublicServiceSelection(service, input.serviceVariantId);
  if (input.type === "Booking request" && input.schedules.length < snapshot.defaultSessionCount) throw new ValidationStoreError("SCHEDULE_REQUIRED");
  const capacity = normalizeServiceAvailability(service.availability).mode === "Flexible" || input.type !== "Booking request"
    ? { requests: [] as PublicRequest[], bookings: [] as ReturnType<typeof cloudBookingsForCapacity> }
    : await capacityDocuments(admin, businessId);
  const availabilityKeys = validateAvailabilityKeys({ page, request: input, ...capacity });
  const duplicate = await admin.from("qai_space_requests").select("payload").eq("business_id", businessId).eq("idempotency_key", input.submissionId).maybeSingle();
  if (duplicate.error) throw duplicate.error;
  if (duplicate.data) return NextResponse.json({ data: publicRequestSchema.parse(duplicate.data.payload) });

  const id = crypto.randomUUID();
  const now = Date.now();
  let schedules = input.schedules;
  if (input.type === "Instant booking") {
    if (!input.instantSlotId) throw new ValidationStoreError("SLOT_REQUIRED");
    const slot = page.slots.find((item) => item.id === input.instantSlotId && item.serviceId === service.serviceId);
    if (!slot || slot.status !== "Available") throw new ValidationStoreError("SLOT_TAKEN");
    const start = localSchedulePart(slot.startAt, page.timezone);
    const end = localSchedulePart(slot.endAt, page.timezone);
    schedules = [{ id: crypto.randomUUID(), label: "", date: start.date, startTime: start.time, endTime: end.time, location: slot.location }];
  }
  const created = publicRequestSchema.parse({
    ...input,
    id,
    pageId: page.id,
    serviceName: service.title,
    serviceSnapshot: snapshot,
    clientId: null,
    schedules,
    availabilityKeys,
    availabilityKey: availabilityKeys[0] ?? null,
    status: input.type === "Instant booking" ? "Accepted" : "Pending",
    submittedAt: now,
    updatedAt: now,
    bookingId: null,
  });
  if (input.type === "Instant booking") {
    const { data, error } = await admin.rpc("reserve_qai_space_instant_request", {
      target_business_id: businessId,
      target_page_id: page.id,
      target_slot_id: input.instantSlotId,
      target_request_id: id,
      target_request_payload: created,
      target_idempotency_key: input.submissionId,
    }).maybeSingle();
    if (error || !data) throw new ValidationStoreError("SLOT_TAKEN");
    const reserved = publicRequestSchema.parse(data);
    await sendCloudBusinessPush(businessId, "bookingRequests", { title: "New instant booking", body: `${reserved.clientName} booked ${reserved.serviceName}.`, url: "/space?tab=Requests", tag: `qai-request-${reserved.id}` }).catch(() => undefined);
    return NextResponse.json({ data: reserved });
  }
  const { data, error } = await admin.from("qai_space_requests").insert({ id, business_id: businessId, page_id: page.id, page_slug: page.slug, service_id: service.serviceId, payload: created, idempotency_key: input.submissionId }).select("payload").maybeSingle();
  if (error || !data) throw error ?? new Error("REQUEST_SAVE_FAILED");
  const inserted = publicRequestSchema.parse(data.payload);
  await sendCloudBusinessPush(businessId, "bookingRequests", { title: inserted.type === "Inquiry" ? "New service inquiry" : "New booking request", body: `${inserted.clientName} asked about ${inserted.serviceName}.`, url: "/space?tab=Requests", tag: `qai-request-${inserted.id}` }).catch(() => undefined);
  return NextResponse.json({ data: inserted });
}

async function claimRequest(requestId: string) {
  const context = await requireCloudBusinessContext();
  const { data: row, error } = await context.client.from("qai_space_requests").select("payload").eq("business_id", context.businessId).eq("id", requestId).maybeSingle();
  if (error) throw error;
  if (!row) throw new ValidationStoreError("REQUEST_NOT_FOUND");
  const current = publicRequestSchema.parse(row.payload);
  if (current.status === "Accepted") return NextResponse.json({ data: current });
  if (current.status === "Declined") throw new ValidationStoreError("REQUEST_DECLINED");
  const { admin, pageRow, page } = await publicPageBySlug(current.slug);
  if (String(pageRow.business_id) !== context.businessId) throw new ValidationStoreError("REQUEST_NOT_FOUND");
  const service = page.services.find((item) => item.serviceId === current.serviceId);
  if (!service) throw new ValidationStoreError("SERVICE_NOT_AVAILABLE");
  const targetSlots = current.type === "Booking request" && normalizeServiceAvailability(service.availability).mode !== "Flexible"
    ? current.schedules.map((schedule) => {
      const slot = findServiceSlot(service.serviceId, service.availability, schedule.date, schedule.startTime, current.serviceSnapshot?.duration ?? service.durationMinutes, page.timezone);
      if (!slot || slot.endTime !== schedule.endTime) throw new ValidationStoreError("SCHEDULE_NOT_AVAILABLE");
      return { serviceId: service.serviceId, key: slot.key, date: slot.date, startTime: slot.startTime, capacity: slot.capacity, manualBlocked: slot.manualBlocked };
    })
    : [];
  if (!targetSlots.length) {
    const accepted = publicRequestSchema.parse({ ...current, status: "Accepted", updatedAt: Date.now() });
    const { data, error: updateError } = await context.client.from("qai_space_requests").update({ payload: accepted, updated_at: new Date().toISOString() }).eq("business_id", context.businessId).eq("id", requestId).select("payload").maybeSingle();
    if (updateError || !data) throw updateError ?? new ValidationStoreError("REQUEST_NOT_FOUND");
    return NextResponse.json({ data: publicRequestSchema.parse(data.payload) });
  }
  const { data, error: claimError } = await admin.rpc("claim_qai_space_request_capacity", { target_request_id: requestId, target_slots: targetSlots }).maybeSingle();
  if (claimError) {
    if (/SESSION_FULL/.test(claimError.message)) throw new ValidationStoreError("SESSION_FULL");
    if (/REQUEST_NOT_FOUND/.test(claimError.message)) throw new ValidationStoreError("REQUEST_NOT_FOUND");
    throw claimError;
  }
  return NextResponse.json({ data: publicRequestSchema.parse(data) });
}

async function updateRequest(input: z.infer<typeof updateRequestAction>) {
  const context = await requireCloudBusinessContext();
  const { data: row, error } = await context.client.from("qai_space_requests").select("payload").eq("business_id", context.businessId).eq("id", input.requestId).maybeSingle();
  if (error) throw error;
  if (!row) throw new ValidationStoreError("REQUEST_NOT_FOUND");
  const current = publicRequestSchema.parse(row.payload);
  if (current.status === "Declined" && input.status === "Accepted") throw new ValidationStoreError("REQUEST_DECLINED");
  if (current.status !== "Accepted" && input.status === "Accepted") throw new ValidationStoreError("CAPACITY_CLAIM_REQUIRED");
  const updated = publicRequestSchema.parse({ ...current, status: input.status, bookingId: input.bookingId, clientId: input.clientId ?? current.clientId, updatedAt: Date.now() });
  const { data, error: updateError } = await context.client.from("qai_space_requests").update({ payload: updated, updated_at: new Date().toISOString() }).eq("business_id", context.businessId).eq("id", input.requestId).select("payload").maybeSingle();
  if (updateError || !data) throw updateError ?? new ValidationStoreError("REQUEST_NOT_FOUND");
  return NextResponse.json({ data: publicRequestSchema.parse(data.payload) });
}
