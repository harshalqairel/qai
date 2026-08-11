import { NextResponse } from "next/server";
import { z } from "zod";

import { createValidationAdminClient } from "@/lib/validation/admin";
import { requireValidationSession } from "@/lib/validation/session";

const inputSchema = z.object({ prefix: z.string().trim().min(1).max(12).regex(/^[A-Za-z0-9-]+$/), year: z.number().int().min(2000).max(2200), minimumSequence: z.number().int().positive(), padding: z.number().int().min(2).max(8) });

export async function POST(request: Request) {
  try {
    const session = await requireValidationSession();
    const input = inputSchema.parse(await request.json());
    const admin = createValidationAdminClient();
    const { data, error } = await admin.rpc("allocate_validation_invoice_number", { target_workspace_id: session.workspaceId, target_prefix: input.prefix, target_year: input.year, minimum_sequence: input.minimumSequence, padding: input.padding }).single();
    if (error || !data) throw error;
    const allocated = data as { invoice_number: string; sequence_number: number };
    return NextResponse.json({ data: { invoiceNumber: allocated.invoice_number, sequence: allocated.sequence_number } });
  } catch { return NextResponse.json({ error: "Could not allocate an invoice number." }, { status: 409 }); }
}
