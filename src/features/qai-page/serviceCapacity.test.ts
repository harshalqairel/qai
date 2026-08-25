import { describe, expect, it } from "vitest";

import type { Booking } from "@/features/booking/types";
import { reconcileBookingCapacitySlotKeys } from "@/features/booking/domain/bookingCapacity";
import { bookingRecordSchema } from "@/features/booking/schema";
import { serviceSlotKey } from "@/features/service/domain/serviceAvailability";
import type { PublicRequest, PublicService } from "./validation";
import { availableServiceSlotsForDate, confirmedServiceSlotCounts } from "./serviceCapacity";

const service: PublicService = {
  serviceId: "service-a",
  visible: true,
  title: "Workshop",
  description: "",
  price: 100_000,
  priceMode: "Fixed price",
  actionMode: "Booking request",
  durationMinutes: 60,
  defaultSessionCount: 1,
  locationPolicy: "Business/studio only",
  optionGroups: [],
  variants: [],
  position: 0,
  featured: false,
  availability: {
    mode: "Dated sessions",
    capacityMode: "Multiple bookings",
    defaultCapacity: 5,
    recurringTimes: [],
    datedSessions: [{ id: "session-1", date: "2026-09-10", startTime: "19:00", endTime: "20:00", location: "Studio", capacity: 5, manualBlocked: 1, active: true }],
    overrides: [],
  },
};

const slotKey = serviceSlotKey("service-a", "session-1", "2026-09-10", "19:00");

function request(changes: Partial<PublicRequest> = {}): PublicRequest {
  return {
    id: "request-1", pageId: "page-1", slug: "studio", serviceId: "service-a", serviceName: "Workshop", type: "Booking request",
    clientName: "Client", whatsapp: "0812345678", email: "", instagram: "", submissionId: "submission-1", clientId: null,
    serviceVariantId: null, serviceSnapshot: null, need: "", schedules: [{ id: "schedule-1", label: "", date: "2026-09-10", startTime: "19:00", endTime: "20:00", location: "Studio" }],
    location: "Studio", budget: "", questionnaireResponses: [], notes: "", status: "Accepted", submittedAt: 1, updatedAt: 1,
    bookingId: null, instantSlotId: null, availabilityKey: slotKey, availabilityKeys: [slotKey], ...changes,
  };
}

function booking(changes: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1", customerId: "customer-1", serviceId: "service-a", sessions: [{ id: "booking-session-1", bookingId: "booking-1", sequence: 1, label: "", startAt: "2026-09-10T12:00:00.000Z", endAt: "2026-09-10T13:00:00.000Z", location: "Studio", notes: "", createdAt: 1, updatedAt: 1 }],
    servicePrice: 100_000, capacitySourceRequestId: "request-1", capacitySlotKeys: [slotKey], bookingStatus: "Scheduled",
    fullPaymentDueDate: "2026-09-10", notes: "", createdAt: 1, updatedAt: 1, ...changes,
  };
}

describe("service capacity accounting", () => {
  it("counts an accepted request converted to a Booking exactly once", () => {
    const counts = confirmedServiceSlotCounts(service, [request({ bookingId: "booking-1" })], [booking()], "Asia/Jakarta");
    expect(counts.get(slotKey)).toBe(1);
    expect(confirmedServiceSlotCounts(service, [request({ bookingId: "booking-1" })], [booking()], "America/New_York").get(slotKey)).toBe(1);
  });

  it("does not consume capacity for pending or declined requests", () => {
    const counts = confirmedServiceSlotCounts(service, [request({ status: "Pending" }), request({ id: "request-2", status: "Declined" })], [], "Asia/Jakarta");
    expect(counts.get(slotKey)).toBeUndefined();
  });

  it("releases a converted reservation when its Booking is cancelled or deleted", () => {
    expect(confirmedServiceSlotCounts(service, [request({ bookingId: "booking-1" })], [booking({ bookingStatus: "Cancelled" })], "Asia/Jakarta").get(slotKey)).toBeUndefined();
    expect(confirmedServiceSlotCounts(service, [request({ bookingId: "booking-1" })], [], "Asia/Jakarta").get(slotKey)).toBeUndefined();
  });

  it("subtracts manual blocks, clamps at zero, and marks a filled session unavailable", () => {
    const bookings = [booking(), booking({ id: "booking-2", capacitySourceRequestId: null }), booking({ id: "booking-3", capacitySourceRequestId: null }), booking({ id: "booking-4", capacitySourceRequestId: null })];
    const [slot] = availableServiceSlotsForDate({ service, variantId: null, date: "2026-09-10", timezone: "Asia/Jakarta", requests: [], bookings });
    expect(slot).toMatchObject({ capacity: 5, manualBlocked: 1, confirmedBookings: 4, remaining: 0, full: true });
  });

  it("uses service and source IDs in stable slot identity", () => {
    expect(serviceSlotKey("service-a", "session-1", "2026-09-10", "19:00")).not.toBe(serviceSlotKey("service-b", "session-1", "2026-09-10", "19:00"));
    expect(serviceSlotKey("service-a", "session-1", "2026-09-10", "19:00")).not.toBe(serviceSlotKey("service-a", "session-2", "2026-09-10", "19:00"));
  });

  it("drops capacity for a deleted or moved session without timezone reinterpretation", () => {
    const current = booking();
    expect(reconcileBookingCapacitySlotKeys(current, [])).toEqual([]);
    expect(reconcileBookingCapacitySlotKeys(current, [{ ...current.sessions[0], startAt: "2026-09-10T13:00:00.000Z", endAt: "2026-09-10T14:00:00.000Z" }])).toEqual([]);
    expect(reconcileBookingCapacitySlotKeys(current, current.sessions)).toEqual([slotKey]);
  });

  it("keeps a historical Booking snapshot valid after availability rules change", () => {
    const historical = booking();
    const changedService: PublicService = { ...service, availability: { ...service.availability!, datedSessions: [{ ...service.availability!.datedSessions[0], id: "replacement-session", capacity: 8 }] } };
    expect(bookingRecordSchema.parse(historical).capacitySlotKeys).toEqual([slotKey]);
    expect(confirmedServiceSlotCounts(changedService, [], [historical], "Asia/Jakarta").get(slotKey)).toBe(1);
    expect(availableServiceSlotsForDate({ service: changedService, variantId: null, date: "2026-09-10", timezone: "Asia/Jakarta", requests: [], bookings: [historical] })[0]).toMatchObject({ capacity: 8, confirmedBookings: 0, remaining: 7 });
  });
});
