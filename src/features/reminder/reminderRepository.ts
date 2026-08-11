import { z } from "zod";
import { emitDataRefresh } from "@/lib/dataRefresh";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { LOCAL_BUSINESS_ID } from "./reminderTemplates";
import type { ReminderHistoryRecord } from "./types";

const STORAGE_KEY = "qai:reminder-history";
const STORAGE_VERSION = 2;
const recordSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  bookingId: z.string().min(1),
  customerId: z.string().min(1),
  remindedAt: z.string().datetime(),
  method: z.enum(["WhatsApp", "Email"]),
  reminderType: z.enum(["due-soon", "overdue"]),
  outstandingBalance: z.number().nonnegative(),
  dueDateSnapshot: z.string().optional(),
});

function migrate(records: unknown[]): unknown[] {
  return records.map((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return record;
    return {
      businessId: LOCAL_BUSINESS_ID,
      reminderType: "due-soon",
      ...record,
    };
  });
}

function getAll(): ReminderHistoryRecord[] {
  return readVersionedCollection(STORAGE_KEY, recordSchema, {
    version: STORAGE_VERSION,
    migrateLegacy: migrate,
    migrateVersioned: migrate,
  });
}

export function getReminderHistory(businessId: string, bookingId?: string): ReminderHistoryRecord[] {
  return getAll()
    .filter((record) => record.businessId === businessId && (!bookingId || record.bookingId === bookingId))
    .sort((left, right) => right.remindedAt.localeCompare(left.remindedAt));
}

export function getLatestReminder(businessId: string, bookingId: string): ReminderHistoryRecord | null {
  return getReminderHistory(businessId, bookingId)[0] ?? null;
}

export function addReminderHistory(record: ReminderHistoryRecord): void {
  const current = getAll();
  if (current.some((item) => item.id === record.id)) return;
  writeVersionedCollection(STORAGE_KEY, recordSchema, [...current, record], { version: STORAGE_VERSION });
  emitDataRefresh();
}
