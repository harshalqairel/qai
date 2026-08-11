import { z } from "zod";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import type { ReminderHistoryRecord } from "./types";

const STORAGE_KEY = "qai:reminder-history";
const recordSchema = z.object({
  id: z.string().min(1),
  bookingId: z.string().min(1),
  customerId: z.string().min(1),
  remindedAt: z.string().datetime(),
  method: z.enum(["WhatsApp", "Email"]),
  outstandingBalance: z.number().nonnegative(),
});

export function addReminderHistory(record: ReminderHistoryRecord): void {
  const current = readVersionedCollection(STORAGE_KEY, recordSchema);
  writeVersionedCollection(STORAGE_KEY, recordSchema, [...current, record]);
}
