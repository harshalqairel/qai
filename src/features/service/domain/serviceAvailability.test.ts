import { describe, expect, it } from "vitest";

import type { ServiceAvailability } from "../types";
import { calculateServiceSlotAvailability, normalizeServiceAvailability, serviceSlotsForDate } from "./serviceAvailability";
import { serviceAvailabilitySchema } from "../schema";

const recurring: ServiceAvailability = {
  mode: "Recurring times",
  capacityMode: "Multiple bookings",
  defaultCapacity: 5,
  recurringTimes: [
    { id: "m-10", weekday: 0, startTime: "10:00", capacity: null, manualBlocked: 1 },
    { id: "m-15", weekday: 0, startTime: "15:00", capacity: 8, manualBlocked: 0 },
    { id: "t-09", weekday: 1, startTime: "09:00", capacity: null, manualBlocked: 0 },
  ],
  datedSessions: [],
  overrides: [],
};

describe("service booking availability", () => {
  it("keeps an existing service without availability configuration flexible", () => {
    expect(normalizeServiceAvailability(undefined)).toMatchObject({ mode: "Flexible", capacityMode: "One booking", defaultCapacity: 1 });
  });

  it("generates only the configured weekday times in the business timezone", () => {
    const monday = serviceSlotsForDate("service-a", recurring, "2026-08-31", 90, "Asia/Jakarta");
    expect(monday.map((slot) => [slot.startTime, slot.endTime])).toEqual([["10:00", "11:30"], ["15:00", "16:30"]]);
    expect(monday[0].key).toBe("service-a|m-10|2026-08-31T10:00");
    expect(serviceSlotsForDate("service-a", recurring, "2026-09-01", 60, "Asia/Jakarta").map((slot) => slot.startTime)).toEqual(["09:00"]);
  });

  it("handles overnight duration and a date-specific closure without browser timezone drift", () => {
    const configured: ServiceAvailability = { ...recurring, recurringTimes: [{ id: "late", weekday: 0, startTime: "23:30", capacity: null, manualBlocked: 0 }], overrides: [] };
    expect(serviceSlotsForDate("service-a", configured, "2026-08-31", 90, "Asia/Jakarta")[0].endTime).toBe("01:00");
    expect(serviceSlotsForDate("service-a", { ...configured, overrides: [{ id: "closed", date: "2026-08-31", startTime: "23:30", capacity: null, manualBlocked: 0, unavailable: true }] }, "2026-08-31", 90, "Asia/Jakarta")).toEqual([]);
  });

  it("keeps total spots, Qai bookings, and reserved spots distinct", () => {
    const slot = serviceSlotsForDate("service-a", recurring, "2026-08-31", 60, "Asia/Jakarta")[0];
    expect(calculateServiceSlotAvailability(slot, 3)).toMatchObject({ capacity: 5, manualBlocked: 1, confirmedBookings: 3, remaining: 1, full: false });
    expect(calculateServiceSlotAvailability(slot, 4)).toMatchObject({ remaining: 0, full: true });
  });

  it("does not resolve an inactive dated session", () => {
    const dated: ServiceAvailability = { mode: "Dated sessions", capacityMode: "Multiple bookings", defaultCapacity: 5, recurringTimes: [], datedSessions: [{ id: "event", date: "2026-09-10", startTime: "19:00", endTime: "20:00", location: "", capacity: 5, manualBlocked: 0, active: false }], overrides: [] };
    expect(serviceSlotsForDate("service-a", dated, "2026-09-10", 60, "Asia/Jakarta")).toEqual([]);
  });

  it("rejects ambiguous duplicate identities for the same local service time", () => {
    expect(serviceAvailabilitySchema.safeParse({ ...recurring, recurringTimes: [...recurring.recurringTimes, { ...recurring.recurringTimes[0], id: "duplicate" }] }).success).toBe(false);
  });
});
