import { describe, expect, it } from "vitest";
import type { Service } from "@/features/service/types";
import type { PublicService } from "./validation";
import { mergePublicServices, updatePublicServiceOrder } from "./publicServiceSync";

function service(id: string, overrides: Partial<Service> = {}): Service {
  return {
    id,
    name: `Service ${id}`,
    categoryId: "category-1",
    price: 1_000_000,
    duration: 60,
    defaultSessionCount: 1,
    description: `Description ${id}`,
    active: true,
    ...overrides,
  };
}

function configured(record: Service, position: number, overrides: Partial<PublicService> = {}): PublicService {
  return {
    serviceId: record.id,
    visible: true,
    title: record.name,
    description: record.description,
    price: record.price,
    priceMode: "Fixed price",
    actionMode: "Booking request",
    durationMinutes: record.duration,
    defaultSessionCount: record.defaultSessionCount,
    locationPolicy: "Client can choose",
    optionGroups: [],
    variants: [],
    position,
    featured: false,
    ...overrides,
  };
}

describe("Qai Space service synchronization", () => {
  it("keeps explicit public order independent from operational array order", () => {
    const first = service("first");
    const second = service("second");
    const stored = [configured(second, 0), configured(first, 1)];
    expect(mergePublicServices(stored, [first, second]).map((item) => item.serviceId)).toEqual(["second", "first"]);
    expect(updatePublicServiceOrder(mergePublicServices(stored, [first, second]), "first", -1).map((item) => item.serviceId)).toEqual(["first", "second"]);
  });

  it("inherits live operational data while preserving presentation controls", () => {
    const original = service("one");
    const stored = configured(original, 0, { featured: true, actionMode: "Inquiry", titleSource: "Service", priceSource: "Service" });
    const changed = service("one", {
      name: "Renamed service",
      price: 2_500_000,
      duration: 90,
      description: "Updated description",
      variants: [{ id: "variant-1", optionValueIds: ["value-1"], displayLabel: "Owner", price: 3_000_000, duration: 120, defaultSessionCount: 2, active: true }],
      availability: { mode: "Recurring times", capacityMode: "Multiple bookings", defaultCapacity: 8, recurringTimes: [{ id: "slot-1", weekday: 1, startTime: "10:00", capacity: 8, manualBlocked: 1 }], datedSessions: [], overrides: [] },
    });
    const [merged] = mergePublicServices([stored], [changed]);
    expect(merged).toMatchObject({ title: "Renamed service", titleSource: "Service", price: 2_500_000, priceSource: "Service", durationMinutes: 90, description: "Updated description", featured: true, actionMode: "Inquiry" });
    expect(merged.variants).toHaveLength(1);
    expect(merged.availability).toMatchObject({ mode: "Recurring times", defaultCapacity: 8 });
  });

  it("keeps explicit title and price overrides but hides inactive and omits deleted services", () => {
    const record = service("one");
    const stored = configured(record, 0, { title: "Wedding Signature", titleSource: "Custom", price: 1_750_000, priceSource: "Custom" });
    const [merged] = mergePublicServices([stored], [service("one", { name: "Wedding", price: 2_000_000 })]);
    expect(merged).toMatchObject({ title: "Wedding Signature", price: 1_750_000 });
    expect(mergePublicServices([stored], [service("one", { active: false })])).toEqual([]);
    expect(mergePublicServices([stored], [])).toEqual([]);
  });

  it("adds new operational services hidden at the end", () => {
    const first = service("first");
    const [existing, added] = mergePublicServices([configured(first, 0)], [first, service("new")], { includeInactive: true });
    expect(existing.visible).toBe(true);
    expect(added).toMatchObject({ serviceId: "new", visible: false, position: 1, titleSource: "Service", priceSource: "Service" });
  });
});
