import { NextResponse } from "next/server";
import { z } from "zod";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { requireValidationSession } from "@/lib/validation/session";
import { bookingRecordSchema } from "@/features/booking/schema";
import { categoryRecordSchema } from "@/features/category/schema";
import { customerRecordSchema } from "@/features/customer/schema";
import { expenseRecordSchema } from "@/features/expense/schema";
import { paymentRecordSchema } from "@/features/payment/schema";
import { serviceRecordSchema } from "@/features/service/schema";
import { qaiPageSchema } from "@/features/qai-page/validation";
import { mergePublicServices } from "@/features/qai-page/publicServiceSync";

export const runtime = "nodejs";

const documentSchema = z.object({ storageKey: z.string().regex(/^qai:/).max(160), value: z.unknown() });
const inputSchema = z.object({ documents: z.array(documentSchema).min(1).max(50) });
const receiptSchema = z.object({ id: z.string(), sourceHash: z.string(), fileName: z.string(), createdAt: z.number() });
const knownCollections = new Map<string, z.ZodTypeAny>([
  ["qai:customers", customerRecordSchema], ["qai:service-categories", categoryRecordSchema], ["qai:services", serviceRecordSchema],
  ["qai:bookings", bookingRecordSchema], ["qai:payments", paymentRecordSchema], ["qai:expense-categories", categoryRecordSchema],
  ["qai:expenses", expenseRecordSchema], ["qai:spreadsheet-import-receipts", receiptSchema],
]);
const serviceEnvelopeSchema = z.object({ version: z.number().int().nonnegative(), data: z.array(serviceRecordSchema), updatedAt: z.number().int().nonnegative() });

function validKnownCollection(storageKey: string, value: unknown): boolean {
  const record = knownCollections.get(storageKey); if (!record) return true;
  return z.object({ version: z.number().int().nonnegative(), data: z.array(record), updatedAt: z.number().int().nonnegative() }).safeParse(value).success;
}

export async function GET() {
  try {
    const session = await requireValidationSession();
    const admin = createValidationAdminClient();
    const [{ data, error }, { data: workspace }] = await Promise.all([admin.from("validation_workspace_documents").select("storage_key, value, updated_at").eq("workspace_id", session.workspaceId), admin.from("validation_workspaces").select("label, public_slug").eq("id", session.workspaceId).single()]);
    if (error) throw error;
    return NextResponse.json({ data: (data ?? []).map((item) => ({ storageKey: item.storage_key, value: item.value, updatedAt: item.updated_at })), workspace: workspace ? { label: workspace.label, slug: workspace.public_slug } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Validation access is required." }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireValidationSession();
    const { documents } = inputSchema.parse(await request.json());
    if (documents.some((document) => !validKnownCollection(document.storageKey, document.value))) return NextResponse.json({ error: "Workspace data did not pass server validation." }, { status: 400 });
    const admin = createValidationAdminClient();
    const serviceWrite = documents.find((document) => document.storageKey === "qai:services");
    if (serviceWrite) {
      const nextServices = serviceEnvelopeSchema.parse(serviceWrite.value).data;
      const [{ data: pageRow }, { data: previousDocument }] = await Promise.all([
        admin.from("validation_public_pages").select("payload").eq("workspace_id", session.workspaceId).maybeSingle(),
        admin.from("validation_workspace_documents").select("value").eq("workspace_id", session.workspaceId).eq("storage_key", "qai:services").maybeSingle(),
      ]);
      if (pageRow) {
        const page = qaiPageSchema.parse(pageRow.payload);
        const previousServices = serviceEnvelopeSchema.safeParse(previousDocument?.value);
        const presentation = previousServices.success
          ? mergePublicServices(page.services, previousServices.data.data, { includeInactive: true })
          : page.services;
        const synchronized = { ...page, services: mergePublicServices(presentation, nextServices, { includeInactive: true }) };
        const { error: pageError } = await admin.from("validation_public_pages").update({ payload: synchronized }).eq("workspace_id", session.workspaceId);
        if (pageError) throw pageError;
      }
    }
    const { error } = await admin.from("validation_workspace_documents").upsert(documents.map((item) => ({ workspace_id: session.workspaceId, storage_key: item.storageKey, value: item.value, updated_at: new Date().toISOString() })), { onConflict: "workspace_id,storage_key" });
    if (error) throw error;
    return NextResponse.json({ data: { saved: documents.length } });
  } catch {
    return NextResponse.json({ error: "Could not save workspace data." }, { status: 400 });
  }
}
