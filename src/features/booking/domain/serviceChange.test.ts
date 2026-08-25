import { describe, expect, it } from "vitest";
import type { Booking } from "@/features/booking/types";
import type { Service } from "@/features/service/types";
import { buildBulkServiceChangeInput, bulkServiceChangeEligibility, recommendedServiceChangePriceMode } from "./serviceChange";

const booking: Booking = {
  id: "booking-1",
  customerId: "client-1",
  serviceId: "service-old",
  serviceSnapshot: { serviceName: "Old service", variantId: "old-variant", variantLabel: "Old choice", options: [{ groupId: "old-group", groupName: "Package", valueId: "old-value", valueLabel: "Old" }], price: 2_500_000, duration: 120, defaultSessionCount: 1 },
  sessions: [{ id: "session-1", bookingId: "booking-1", sequence: 1, label: "Main", startAt: "2026-09-10T12:00:00.000Z", endAt: "2026-09-10T14:00:00.000Z", location: "Studio", notes: "Keep", createdAt: 1, updatedAt: 1 }],
  servicePrice: 2_750_000,
  additionalCharges: [{ id: "charge-1", bookingId: "booking-1", sessionId: "session-1", categoryId: "travel", categoryName: "Travel", description: "Parking", amount: 50_000, createdAt: 1, updatedAt: 1 }],
  questionnaireResponses: [{ questionId: "old-question", labelSnapshot: "Old answer", typeSnapshot: "Short text", answer: "Keep this history" }],
  capacitySourceRequestId: "request-1",
  capacitySlotKeys: [],
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "2026-09-01",
  notes: "Historical notes",
  createdAt: 1,
  updatedAt: 1,
};

const nextService: Service = {
  id: "service-new",
  name: "New service",
  categoryId: "category-1",
  price: 1_500_000,
  duration: 60,
  defaultSessionCount: 1,
  description: "",
  active: true,
  optionGroups: [{ id: "new-group", name: "Tier", position: 0, values: [{ id: "new-value", label: "Standard", active: true, position: 0 }] }],
  variants: [{ id: "new-variant", optionValueIds: ["new-value"], displayLabel: "Standard", price: 1_500_000, duration: 60, defaultSessionCount: 1, active: true }],
};

describe("booking service changes", () => {
  it("replaces the old service/variant snapshot while preserving money, schedules, and historical records", () => {
    const update = buildBulkServiceChangeInput(booking, nextService, "Asia/Jakarta");
    expect(update.serviceId).toBe("service-new");
    expect(update.serviceSnapshot).toMatchObject({ serviceName: "New service", variantId: "new-variant", variantLabel: "Standard" });
    expect(JSON.stringify(update.serviceSnapshot)).not.toContain("old-variant");
    expect(update.servicePrice).toBe(2_750_000);
    expect(update.sessions).toEqual([{ id: "session-1", label: "Main", date: "2026-09-10", startTime: "19:00", endTime: "21:00", location: "Studio", notes: "Keep" }]);
    expect(update.additionalCharges?.[0]).toMatchObject({ id: "charge-1", amount: 50_000 });
    expect(update.questionnaireResponses).toEqual(booking.questionnaireResponses);
    expect(update.capacitySourceRequestId).toBeNull();
    expect(update.capacitySlotKeys).toEqual([]);
  });

  it("requires individual review for capacity sessions, managed destinations, and issued invoices", () => {
    expect(bulkServiceChangeEligibility({ ...booking, capacitySlotKeys: ["service-old|slot|2026-09-10T19:00"] }, nextService, [])).toMatchObject({ eligible: false, reason: "capacity-session" });
    expect(bulkServiceChangeEligibility(booking, { ...nextService, availability: { mode: "Recurring times", capacityMode: "Multiple bookings", defaultCapacity: 5, recurringTimes: [], datedSessions: [], overrides: [] } }, [])).toMatchObject({ eligible: false, reason: "destination-availability" });
    expect(bulkServiceChangeEligibility(booking, nextService, [{ bookingId: booking.id, lifecycle: "Issued" }])).toMatchObject({ eligible: false, reason: "issued-invoice" });
  });

  it("uses a new default price only when the existing amount is still an unlocked service default", () => {
    const safeDefault = { currentPrice: 2_500_000, originalDefaultPrice: 2_500_000, hasPayments: false, hasIssuedInvoice: false };
    expect(recommendedServiceChangePriceMode(safeDefault)).toBe("use-new-default");
    expect(recommendedServiceChangePriceMode({ ...safeDefault, hasPayments: true })).toBe("keep-current");
    expect(recommendedServiceChangePriceMode({ ...safeDefault, hasIssuedInvoice: true })).toBe("keep-current");
    expect(recommendedServiceChangePriceMode({ ...safeDefault, currentPrice: 2_750_000 })).toBe("keep-current");
  });
});
