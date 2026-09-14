"use client";

import { z } from "zod";
import { emitDataRefresh } from "@/lib/dataRefresh";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessContext } from "@/lib/supabase/cloudRepositories";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import {
  clientCommunicationSchema,
  type ClientCommunication,
  type CreateCommunicationInput,
} from "./types";

const LOCAL_STORAGE_KEY = "qai:client-communications";
const LOCAL_STORAGE_VERSION = 1;

type DbRow = Record<string, unknown>;

function valueAsString(row: DbRow, key: string): string {
  return typeof row[key] === "string" ? row[key] as string : "";
}

function communicationFromRow(row: DbRow): ClientCommunication {
  return clientCommunicationSchema.parse({
    id: valueAsString(row, "id"),
    businessId: valueAsString(row, "business_id"),
    customerId: valueAsString(row, "customer_id"),
    bookingId: valueAsString(row, "booking_id") || null,
    actorUserId: valueAsString(row, "actor_user_id") || null,
    channel: row.channel,
    templateType: row.template_type,
    actionStatus: row.action_status,
    recipientSnapshot: valueAsString(row, "recipient_snapshot"),
    subject: typeof row.subject === "string" ? row.subject : null,
    bodySnapshot: valueAsString(row, "body_snapshot"),
    providerReference: typeof row.provider_reference === "string" ? row.provider_reference : null,
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {},
    createdAt: valueAsString(row, "created_at"),
    openedAt: typeof row.opened_at === "string" ? row.opened_at : null,
  });
}

function localRecords(): ClientCommunication[] {
  return readVersionedCollection(LOCAL_STORAGE_KEY, clientCommunicationSchema, {
    version: LOCAL_STORAGE_VERSION,
  });
}

export async function listClientCommunications(filters: {
  bookingId?: string;
  customerId?: string;
} = {}): Promise<ClientCommunication[]> {
  if (!isCloudModeEnabled()) {
    return localRecords()
      .filter((record) => !filters.bookingId || record.bookingId === filters.bookingId)
      .filter((record) => !filters.customerId || record.customerId === filters.customerId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  const { businessId } = await getActiveBusinessContext();
  let query = createClient()
    .from("client_communications")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (filters.bookingId) query = query.eq("booking_id", filters.bookingId);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return z.array(z.record(z.string(), z.unknown())).parse(data ?? []).map(communicationFromRow);
}

export async function recordClientCommunication(input: CreateCommunicationInput): Promise<ClientCommunication> {
  const now = new Date().toISOString();
  const actionStatus = input.channel === "whatsapp" ? "whatsapp_opened" : "email_draft_opened";
  if (input.actionStatus !== actionStatus) throw new Error("Communication action does not match its channel.");

  if (!isCloudModeEnabled()) {
    const record = clientCommunicationSchema.parse({
      id: crypto.randomUUID(),
      businessId: "local-business",
      customerId: input.customerId,
      bookingId: input.bookingId ?? null,
      actorUserId: "local-user",
      channel: input.channel,
      templateType: input.templateType,
      actionStatus,
      recipientSnapshot: input.recipientSnapshot,
      subject: input.channel === "email" ? input.subject?.trim() || null : null,
      bodySnapshot: input.bodySnapshot,
      providerReference: null,
      metadata: input.metadata ?? {},
      createdAt: now,
      openedAt: now,
    });
    writeVersionedCollection(
      LOCAL_STORAGE_KEY,
      clientCommunicationSchema,
      [...localRecords(), record],
      { version: LOCAL_STORAGE_VERSION },
    );
    emitDataRefresh();
    return record;
  }

  const [{ businessId }, auth] = await Promise.all([
    getActiveBusinessContext(),
    createClient().auth.getUser(),
  ]);
  if (auth.error || !auth.data.user) throw new Error("Authentication is required to record communication history.");
  const id = crypto.randomUUID();
  const { data, error } = await createClient()
    .from("client_communications")
    .insert({
      id,
      business_id: businessId,
      customer_id: input.customerId,
      booking_id: input.bookingId ?? null,
      actor_user_id: auth.data.user.id,
      channel: input.channel,
      template_type: input.templateType,
      action_status: actionStatus,
      recipient_snapshot: input.recipientSnapshot.trim(),
      subject: input.channel === "email" ? input.subject?.trim() || null : null,
      body_snapshot: input.bodySnapshot.trim(),
      metadata: input.metadata ?? {},
      opened_at: now,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Communication history was not saved.");
  const record = communicationFromRow(data as DbRow);
  emitDataRefresh();
  return record;
}
