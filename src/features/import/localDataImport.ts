"use client";

import { createBackupPayload } from "@/features/backup/backupService";
import type { QaiBackupData } from "@/features/backup/types";
import { emitDataRefresh } from "@/lib/dataRefresh";
import { createClient } from "@/lib/supabase/client";

export type LocalImportPreview = {
  data: QaiBackupData;
  fingerprint: string;
  counts: {
    serviceCategories: number;
    expenseCategories: number;
    customers: number;
    services: number;
    bookings: number;
    payments: number;
    expenses: number;
  };
  totalRecords: number;
};

export type LocalImportResult = "completed" | "already_imported" | "failed";

function sortedData(data: QaiBackupData): QaiBackupData {
  const byId = <T extends { id: string }>(items: readonly T[]) =>
    [...items].sort((left, right) => left.id.localeCompare(right.id));

  return {
    serviceCategories: byId(data.serviceCategories),
    expenseCategories: byId(data.expenseCategories),
    customers: byId(data.customers),
    services: byId(data.services),
    bookings: byId(data.bookings),
    payments: byId(data.payments),
    expenses: byId(data.expenses),
  };
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function prepareLocalImport(): Promise<LocalImportPreview> {
  const data = createBackupPayload().data;
  const counts = {
    serviceCategories: data.serviceCategories.length,
    expenseCategories: data.expenseCategories.length,
    customers: data.customers.length,
    services: data.services.length,
    bookings: data.bookings.length,
    payments: data.payments.length,
    expenses: data.expenses.length,
  };
  const totalRecords = Object.values(counts).reduce((total, count) => total + count, 0);
  const fingerprint = await sha256(JSON.stringify(sortedData(data)));
  return { data, fingerprint, counts, totalRecords };
}

export async function importLocalData(preview: LocalImportPreview): Promise<LocalImportResult> {
  const { data, error } = await createClient().rpc("import_local_data", {
    import_payload: preview.data,
    import_fingerprint: preview.fingerprint,
  });
  if (error) return "failed";

  const status = data && typeof data === "object" && "status" in data
    ? (data as { status?: unknown }).status
    : null;
  if (status === "completed" || status === "already_imported") {
    emitDataRefresh();
    return status;
  }
  return "failed";
}
