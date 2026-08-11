import { z } from "zod";
import { emitDataRefresh } from "@/lib/dataRefresh";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";
import { DEFAULT_REMINDER_TEMPLATES } from "./reminderTemplates";
import type { ReminderTemplateSet } from "./types";

const STORAGE_KEY = "qai:business-reminder-templates";
const scenarioSchema = z.object({
  whatsapp: z.string().max(4000),
  emailSubject: z.string().max(200),
  emailBody: z.string().max(4000),
});
const recordSchema = z.object({
  businessId: z.string().min(1),
  templates: z.object({ dueSoon: scenarioSchema, overdue: scenarioSchema }),
});

function cloneDefaults(): ReminderTemplateSet {
  return structuredClone(DEFAULT_REMINDER_TEMPLATES);
}

export function getReminderTemplates(businessId: string): ReminderTemplateSet {
  return readVersionedCollection(STORAGE_KEY, recordSchema)
    .find((record) => record.businessId === businessId)?.templates ?? cloneDefaults();
}

export function saveReminderTemplates(businessId: string, templates: ReminderTemplateSet): void {
  const records = readVersionedCollection(STORAGE_KEY, recordSchema);
  const next = records.some((record) => record.businessId === businessId)
    ? records.map((record) => record.businessId === businessId ? { businessId, templates } : record)
    : [...records, { businessId, templates }];
  writeVersionedCollection(STORAGE_KEY, recordSchema, next);
  emitDataRefresh();
}
