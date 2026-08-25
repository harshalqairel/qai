import { describe, expect, it } from "vitest";

import type { Booking } from "@/features/booking/types";
import type { Service } from "@/features/service/types";
import { buildUpcomingJobs, type UpcomingBooking } from "./upcomingJobs";

const onlineClass: Service = {
  id: "online-class", name: "Online Class", categoryId: "classes", price: 100_000, duration: 120, defaultSessionCount: 1, description: "", active: true,
  availability: { mode: "Dated sessions", capacityMode: "Multiple bookings", defaultCapacity: 10, recurringTimes: [], overrides: [], datedSessions: [{ id: "class-28", date: "2026-08-28", startTime: "12:00", endTime: "14:00", location: "Online", capacity: 10, manualBlocked: 2, active: true }, { id: "class-28-late", date: "2026-08-28", startTime: "15:00", endTime: "17:00", location: "Online", capacity: 10, manualBlocked: 0, active: true }] },
};
const workshop: Service = { ...onlineClass, id: "workshop", name: "Workshop", availability: { ...onlineClass.availability!, datedSessions: [{ id: "workshop-28", date: "2026-08-28", startTime: "12:00", endTime: "14:00", location: "Studio", capacity: 20, manualBlocked: 0, active: true }] } };
const individualService: Service = { ...onlineClass, id: "portrait", name: "Portrait", availability: undefined };

function booking(id: string, customerName: string, key: string, paymentStatus: UpcomingBooking["paymentStatus"] = "Fully Paid", status: Booking["bookingStatus"] = "Scheduled"): UpcomingBooking {
  const late = key.endsWith("T15:00");
  return { id, customerId: `customer-${id}`, serviceId: key.startsWith("workshop|") ? "workshop" : "online-class", servicePrice: 100_000, sessions: [{ id: `session-${id}`, bookingId: id, sequence: 1, label: "", startAt: late ? "2026-08-28T08:00:00.000Z" : "2026-08-28T05:00:00.000Z", endAt: late ? "2026-08-28T10:00:00.000Z" : "2026-08-28T07:00:00.000Z", location: "Online", notes: "", createdAt: 0, updatedAt: 0 }], capacitySlotKeys: [key], bookingStatus: status, fullPaymentDueDate: "", notes: "", createdAt: 0, updatedAt: 0, customerName, serviceName: key.startsWith("workshop|") ? "Workshop" : "Online Class", paymentStatus };
}

describe("Dashboard upcoming jobs", () => {
  const now = new Date("2026-08-01T00:00:00.000Z");

  it("renders several confirmed bookings for one capacity occurrence as one job with canonical capacity and payment summaries", () => {
    const jobs = buildUpcomingJobs({ bookings: [booking("a", "Alifa", "online-class|class-28|2026-08-28T12:00"), booking("b", "Luthfiyyah", "online-class|class-28|2026-08-28T12:00"), booking("c", "Syasyafirzanah", "online-class|class-28|2026-08-28T12:00", "Outstanding")], services: [onlineClass], timezone: "Asia/Jakarta", now });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "group", serviceName: "Online Class", capacity: { booked: 3, total: 10, reserved: 2, available: 5 }, payment: { label: "2 paid · 1 unpaid" } });
  });

  it("keeps distinct service occurrences separate and excludes cancelled reservations", () => {
    const jobs = buildUpcomingJobs({ bookings: [booking("early", "Alifa", "online-class|class-28|2026-08-28T12:00"), booking("late", "Luthfiyyah", "online-class|class-28-late|2026-08-28T15:00"), booking("workshop", "Nadia", "workshop|workshop-28|2026-08-28T12:00"), booking("cancelled", "Former client", "online-class|class-28|2026-08-28T12:00", "Cancelled", "Cancelled")], services: [onlineClass, workshop], timezone: "Asia/Jakarta", now });
    expect(jobs).toHaveLength(3);
    expect(jobs.filter((job) => job.kind === "group").map((job) => job.key)).toEqual(["online-class|class-28|2026-08-28T12:00", "workshop|workshop-28|2026-08-28T12:00", "online-class|class-28-late|2026-08-28T15:00"]);
  });

  it("keeps ordinary one-to-one work client-centric", () => {
    const individual: UpcomingBooking = { ...booking("portrait", "Arvy", "legacy-slot"), serviceId: "portrait", serviceName: "Premium Package", capacitySlotKeys: [] };
    const jobs = buildUpcomingJobs({ bookings: [individual], services: [individualService], timezone: "Asia/Jakarta", now });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "individual", item: { customerName: "Arvy", serviceName: "Premium Package" } });
  });

  it("uses the configured slot identity for an owner-created group booking that predates capacity snapshots", () => {
    const direct = { ...booking("direct", "Owner entry", "online-class|class-28|2026-08-28T12:00"), capacitySlotKeys: [] };
    const jobs = buildUpcomingJobs({ bookings: [direct], services: [onlineClass], timezone: "Asia/Jakarta", now });
    expect(jobs[0]).toMatchObject({ kind: "group", key: "online-class|class-28|2026-08-28T12:00" });
  });
});
