import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { validateQuestionnaireResponses } from "@/features/booking-questionnaire/questionnaire";

import { publicRequestSchema, qaiPageSchema, snapshotPublicServiceSelection, type PublicRequest, type QaiPageConfig, type ValidationStore } from "./validation";

const storeSchema = z.object({ pages: z.array(qaiPageSchema), requests: z.array(publicRequestSchema) });
export const validationRequestInputSchema = publicRequestSchema.omit({ id: true, status: true, submittedAt: true, updatedAt: true, bookingId: true, clientId: true, serviceSnapshot: true });
export type ValidationRequestInput = z.infer<typeof validationRequestInputSchema>;

export class ValidationStoreError extends Error {
  constructor(readonly code: string) { super(code); }
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

export function createValidationStoreRepository(directory: string) {
  const storeFile = path.join(directory, "store.json");
  let writeQueue: Promise<unknown> = Promise.resolve();

  async function readStore(): Promise<ValidationStore> {
    try { return storeSchema.parse(JSON.parse(await readFile(storeFile, "utf8"))); }
    catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code === "ENOENT") return { pages: [], requests: [] };
      throw error;
    }
  }
  async function writeStore(store: ValidationStore) {
    const parsed = storeSchema.parse(store); await mkdir(directory, { recursive: true });
    const temporary = path.join(directory, `store-${crypto.randomUUID()}.tmp`);
    await writeFile(temporary, JSON.stringify(parsed, null, 2), { encoding: "utf8", flag: "wx" }); await rename(temporary, storeFile);
  }
  function mutate<T>(mutation: (store: ValidationStore) => T | Promise<T>): Promise<T> {
    const operation = writeQueue.then(async () => { const store = await readStore(); const result = await mutation(store); await writeStore(store); return result; });
    writeQueue = operation.catch(() => undefined); return operation;
  }
  return {
    read: readStore,
    async savePage(input: QaiPageConfig) {
      return mutate((store) => {
        if (store.pages.some((page) => page.slug === input.slug && page.id !== input.id)) throw new ValidationStoreError("SLUG_TAKEN");
        const page = qaiPageSchema.parse({ ...input, updatedAt: Date.now() }); const index = store.pages.findIndex((item) => item.id === page.id);
        if (index >= 0) store.pages[index] = page; else store.pages.push(page); return page;
      });
    },
    async submitRequest(input: ValidationRequestInput) {
      return mutate((store) => {
        const page = store.pages.find((item) => item.id === input.pageId && item.slug === input.slug); if (!page) throw new ValidationStoreError("PAGE_NOT_FOUND");
        const service = page.services.find((item) => item.serviceId === input.serviceId && item.visible); if (!service || service.actionMode !== input.type) throw new ValidationStoreError("SERVICE_NOT_AVAILABLE");
        if (Object.keys(validateQuestionnaireResponses(page.questionnaire, service.serviceId, input.questionnaireResponses, true)).length > 0) throw new ValidationStoreError("QUESTIONNAIRE_INVALID");
        const serviceSnapshot = snapshotPublicServiceSelection(service, input.serviceVariantId);
        if (input.type === "Booking request" && input.schedules.length < serviceSnapshot.defaultSessionCount) throw new ValidationStoreError("SCHEDULE_REQUIRED");
        if (input.type === "Instant booking" && !input.instantSlotId) throw new ValidationStoreError("SLOT_REQUIRED");
        const duplicate = store.requests.find((item) => item.pageId === page.id && item.submissionId === input.submissionId);
        if (duplicate) return duplicate;
        const activeVariants = service.variants.filter((variant) => variant.active);
        if (activeVariants.length > 0 && !activeVariants.some((variant) => variant.id === input.serviceVariantId)) throw new ValidationStoreError("SERVICE_VARIANT_REQUIRED");
        const id = crypto.randomUUID(); let schedules = input.schedules; let status: PublicRequest["status"] = "Pending";
        if (input.type === "Instant booking") {
          const slot = page.slots.find((item) => item.id === input.instantSlotId && item.serviceId === service.serviceId);
          if (!slot || slot.status !== "Available") throw new ValidationStoreError("SLOT_TAKEN");
          slot.status = "Reserved"; slot.requestId = id; status = "Accepted";
          const start = localSchedulePart(slot.startAt, page.timezone); const end = localSchedulePart(slot.endAt, page.timezone);
          schedules = [{ id: crypto.randomUUID(), label: "", date: start.date, startTime: start.time, endTime: end.time, location: slot.location }]; page.updatedAt = Date.now();
        }
        const now = Date.now(); const created = publicRequestSchema.parse({ ...input, id, serviceName: service.title, serviceSnapshot, clientId: null, schedules, status, submittedAt: now, updatedAt: now, bookingId: null });
        store.requests.push(created); return created;
      });
    },
    async updateRequest(requestId: string, status: PublicRequest["status"], bookingId: string | null, clientId: string | null = null) {
      return mutate((store) => {
        const item = store.requests.find((candidate) => candidate.id === requestId); if (!item) throw new ValidationStoreError("REQUEST_NOT_FOUND");
        if (item.status === "Accepted" && item.bookingId && status === "Accepted") return item;
        if (item.status === "Declined" && status === "Accepted") throw new ValidationStoreError("REQUEST_DECLINED");
        item.status = status; item.bookingId = bookingId; item.clientId = clientId ?? item.clientId; item.updatedAt = Date.now(); return publicRequestSchema.parse(item);
      });
    },
  };
}
