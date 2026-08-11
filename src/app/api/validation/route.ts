import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { z } from "zod";

import { qaiPageSchema } from "@/features/qai-page/validation";
import { createValidationStoreRepository, ValidationStoreError, validationRequestInputSchema } from "@/features/qai-page/validationStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const repository = createValidationStoreRepository(path.resolve(process.cwd(), ".qai-validation"));
const savePageAction = z.object({ action: z.literal("save-page"), page: qaiPageSchema });
const submitRequestAction = z.object({ action: z.literal("submit-request"), request: validationRequestInputSchema });
const updateRequestAction = z.object({ action: z.literal("update-request"), requestId: z.string().min(1).max(100), status: z.enum(["Pending", "Accepted", "Declined"]), bookingId: z.string().max(100).nullable() });
const actionSchema = z.discriminatedUnion("action", [savePageAction, submitRequestAction, updateRequestAction]);

const MESSAGES: Record<string, string> = {
  SLUG_TAKEN: "This page address is already in use.", PAGE_NOT_FOUND: "This Qai Page is not available.", SERVICE_NOT_AVAILABLE: "This service is not available.",
  SCHEDULE_REQUIRED: "Add at least one preferred schedule.", SLOT_REQUIRED: "Choose an available time.", SLOT_TAKEN: "This time is no longer available. Choose another one.",
  REQUEST_NOT_FOUND: "This request could not be found.", REQUEST_DECLINED: "A declined request cannot be accepted.",
};
function failure(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function GET(request: NextRequest) {
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
  try {
    const data = input.action === "save-page" ? await repository.savePage(input.page)
      : input.action === "submit-request" ? await repository.submitRequest(input.request)
        : await repository.updateRequest(input.requestId, input.status, input.bookingId);
    return NextResponse.json({ data });
  } catch (error) {
    const code = error instanceof ValidationStoreError ? error.code : "";
    return failure(MESSAGES[code] ?? "The validation request could not be completed.", code === "PAGE_NOT_FOUND" ? 404 : 409);
  }
}
