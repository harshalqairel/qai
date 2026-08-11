import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { canShowBookedThroughQai, defaultQaiPage, normalizeContactPhone, normalizeSlug, publicPriceLabel, requestToBookingValues, type QaiPageConfig } from "./validation";
import { createValidationStoreRepository, ValidationStoreError, type ValidationRequestInput } from "./validationStore";

const temporaryDirectories: string[] = [];
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

function page(): QaiPageConfig {
  return {
    ...defaultQaiPage(), id: "page-1", slug: "nuyi", businessName: "Nuyi Makeup Studio",
    services: [
      { serviceId: "request-service", visible: true, title: "Wedding Package", description: "", price: 7_500_000, priceMode: "Starting from", actionMode: "Booking request", durationMinutes: 120 },
      { serviceId: "instant-service", visible: true, title: "Studio Rental", description: "", price: 350_000, priceMode: "Fixed price", actionMode: "Instant booking", durationMinutes: 60 },
    ],
    slots: [{ id: "slot-1", serviceId: "instant-service", startAt: "2026-08-18T03:00:00.000Z", endAt: "2026-08-18T04:00:00.000Z", location: "Studio", status: "Available", requestId: null }],
  };
}

function request(changes: Partial<ValidationRequestInput> = {}): ValidationRequestInput {
  return {
    pageId: "page-1", slug: "nuyi", serviceId: "request-service", serviceName: "Wedding Package", type: "Booking request", clientName: "Sarah",
    whatsapp: "081234567890", email: "", need: "", schedules: [
      { id: "schedule-1", label: "Akad", date: "2026-09-12", startTime: "09:00", endTime: "11:00", location: "Bandung" },
      { id: "schedule-2", label: "Reception", date: "2026-09-15", startTime: "17:00", endTime: "20:00", location: "Bandung" },
      { id: "schedule-3", label: "After party", date: "2026-09-20", startTime: "20:00", endTime: "22:00", location: "Jakarta" },
    ], location: "", budget: "", notes: "", instantSlotId: null, ...changes,
  };
}

async function repository() {
  const directory = await mkdtemp(path.join(tmpdir(), "qai-validation-test-")); temporaryDirectories.push(directory);
  return { directory, repository: createValidationStoreRepository(directory) };
}

describe("Qai Page domain", () => {
  it("normalizes safe slugs, phones, and public price labels", () => {
    expect(normalizeSlug("  Nuyi Makeup & Studio  ")).toBe("nuyi-makeup-studio");
    expect(normalizeSlug("../../secret")).toBe("secret");
    expect(normalizeContactPhone("0812-3456")).toBe("628123456");
    expect(publicPriceLabel(page().services[0])).toBe("Starting from Rp 7.500.000");
    expect(publicPriceLabel({ ...page().services[0], priceMode: "Ask for price" })).toBe("Ask for price");
  });

  it("shows Booked through Qai only for confirmed instant bookings", () => {
    const pending = { ...request(), id: "r1", status: "Pending" as const, submittedAt: 1, updatedAt: 1, bookingId: null };
    expect(canShowBookedThroughQai(pending)).toBe(false);
    expect(canShowBookedThroughQai({ ...pending, type: "Inquiry" })).toBe(false);
    expect(canShowBookedThroughQai({ ...pending, type: "Instant booking", status: "Accepted", instantSlotId: "slot-1" })).toBe(true);
  });

  it("maps one public request to one booking with every requested schedule", () => {
    const source = { ...request(), id: "r1", status: "Pending" as const, submittedAt: 1, updatedAt: 1, bookingId: null };
    const values = requestToBookingValues(source, { id: "request-service", name: "Wedding Package", categoryId: "cat", price: 7_500_000, duration: 120, defaultSessionCount: 1, description: "", active: true }, "client-1", "2026-09-01");
    expect(values.customerId).toBe("client-1"); expect(values.sessions).toHaveLength(3); expect(values.sessions.map((item) => item.date)).toEqual(["2026-09-12", "2026-09-15", "2026-09-20"]);
    expect(values.fullPaymentDueDate).toBe("2026-09-20"); expect(values.servicePrice).toBe(7_500_000);
  });
});

describe("shared validation store", () => {
  it("persists a page and a multi-schedule pending request", async () => {
    const { directory, repository: store } = await repository(); await store.savePage(page());
    const created = await store.submitRequest(request());
    expect(created.status).toBe("Pending"); expect(created.schedules).toHaveLength(3);
    const reloaded = createValidationStoreRepository(directory); expect((await reloaded.read()).requests[0].id).toBe(created.id);
    expect(JSON.parse(await readFile(path.join(directory, "store.json"), "utf8")).requests).toHaveLength(1);
  });

  it("reserves an instant slot atomically when two customers try the same time", async () => {
    const { repository: store } = await repository(); await store.savePage(page());
    const first = request({ serviceId: "instant-service", serviceName: "Studio Rental", type: "Instant booking", schedules: [], instantSlotId: "slot-1", whatsapp: "0812111111" });
    const second = { ...first, whatsapp: "0812222222", clientName: "Other customer" };
    const results = await Promise.allSettled([store.submitRequest(first), store.submitRequest(second)]);
    expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((item) => item.status === "rejected")).toHaveLength(1);
    const fulfilled = results.find((item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof store.submitRequest>>> => item.status === "fulfilled");
    expect(fulfilled?.value.schedules[0]).toMatchObject({ date: "2026-08-18", startTime: "10:00", endTime: "11:00" });
    const rejected = results.find((item): item is PromiseRejectedResult => item.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(ValidationStoreError); expect(rejected?.reason.code).toBe("SLOT_TAKEN");
    const saved = await store.read(); expect(saved.pages[0].slots[0].status).toBe("Reserved"); expect(saved.requests).toHaveLength(1);
  });

  it("prevents duplicate submissions and duplicate accepted-booking links", async () => {
    const { repository: store } = await repository(); await store.savePage(page());
    const first = await store.submitRequest(request()); const duplicate = await store.submitRequest(request());
    expect(duplicate.id).toBe(first.id); expect((await store.read()).requests).toHaveLength(1);
    const accepted = await store.updateRequest(first.id, "Accepted", "booking-1");
    const repeated = await store.updateRequest(first.id, "Accepted", "booking-2");
    expect(accepted.bookingId).toBe("booking-1"); expect(repeated.bookingId).toBe("booking-1");
  });

  it("enforces unique slugs and keeps declined requests without bookings", async () => {
    const { repository: store } = await repository(); await store.savePage(page());
    await expect(store.savePage({ ...page(), id: "page-2", businessId: "business-2" })).rejects.toMatchObject({ code: "SLUG_TAKEN" });
    const created = await store.submitRequest(request()); const declined = await store.updateRequest(created.id, "Declined", null);
    expect(declined.status).toBe("Declined"); expect(declined.bookingId).toBeNull(); expect((await store.read()).requests).toHaveLength(1);
  });
});
