import { describe, expect, it } from "vitest";
import { migrateLegacyBookingRecords } from "@/features/booking/api/localStorageRepository";
import { buildBookingSessions, instantParts, sessionInputToInstants, shouldAutoCompleteBooking } from "./bookingSessions";

describe("booking sessions", () => {
  it("supports non-consecutive sessions and preserves independent durations", () => {
    const sessions = buildBookingSessions("booking-1", [
      { id: "session-1", label: "Akad", date: "2026-08-12", startTime: "09:00", endTime: "11:00", location: "A", notes: "" },
      { id: "session-2", label: "Reception", date: "2026-08-20", startTime: "17:00", endTime: "22:30", location: "B", notes: "" },
    ], "Asia/Jakarta", [], 1);
    expect(sessions.map((item) => instantParts(item.startAt, "Asia/Jakarta").date)).toEqual(["2026-08-12", "2026-08-20"]);
    expect(sessions.map((item) => item.sequence)).toEqual([1, 2]);
  });

  it("generates an identifier when a new form row carries an empty optional id", () => {
    const [created] = buildBookingSessions("booking-1", [
      { id: "", label: "", date: "2026-08-12", startTime: "09:00", endTime: "10:00", location: "", notes: "" },
    ], "Asia/Jakarta", [], 1);
    expect(created.id).not.toBe("");
  });

  it("moves an overnight end time into the following day", () => {
    const result = sessionInputToInstants(
      { label: "Night", date: "2026-08-12", startTime: "22:00", endTime: "02:00", location: "", notes: "" },
      "Asia/Jakarta",
    );
    expect(instantParts(result.startAt, "Asia/Jakarta")).toEqual({ date: "2026-08-12", time: "22:00" });
    expect(instantParts(result.endAt, "Asia/Jakarta")).toEqual({ date: "2026-08-13", time: "02:00" });
  });

  it("auto-completes only on a business-local day after the final session", () => {
    const sessions = buildBookingSessions("booking-1", [
      { id: "session-1", label: "", date: "2026-08-12", startTime: "09:00", endTime: "11:00", location: "", notes: "" },
      { id: "session-2", label: "", date: "2026-08-20", startTime: "22:00", endTime: "02:00", location: "", notes: "" },
    ], "Asia/Jakarta", [], 1);
    expect(shouldAutoCompleteBooking({ bookingStatus: "Scheduled", sessions }, new Date("2026-08-20T20:00:00.000Z"), "Asia/Jakarta")).toBe(false);
    expect(shouldAutoCompleteBooking({ bookingStatus: "Scheduled", sessions }, new Date("2026-08-21T18:00:00.000Z"), "Asia/Jakarta")).toBe(true);
    expect(shouldAutoCompleteBooking({ bookingStatus: "Cancelled", sessions }, new Date("2026-08-21T18:00:00.000Z"), "Asia/Jakarta")).toBe(false);
    expect(shouldAutoCompleteBooking({ bookingStatus: "Completed", sessions }, new Date("2026-08-21T18:00:00.000Z"), "Asia/Jakarta")).toBe(false);
  });

  it("converts a legacy booking to one stable session without duplicating it on retry", () => {
    const legacy = {
      id: "booking-legacy",
      customerId: "customer-1",
      serviceId: "service-1",
      bookingDate: "2026-08-12",
      startTime: "22:00",
      endTime: "02:00",
      location: "Jakarta",
      servicePrice: 1_000_000,
      bookingStatus: "Scheduled",
      fullPaymentDueDate: "2026-08-12",
      notes: "",
      createdAt: 1,
      updatedAt: 1,
    };
    const once = migrateLegacyBookingRecords([legacy]) as Array<{ sessions: Array<{ id: string; sequence: number }> }>;
    const twice = migrateLegacyBookingRecords(once) as Array<{ sessions: Array<{ id: string; sequence: number }> }>;
    expect(once[0].sessions).toHaveLength(1);
    expect(once[0].sessions[0]).toMatchObject({ id: "booking-legacy", sequence: 1 });
    expect(twice[0].sessions).toEqual(once[0].sessions);
  });
});
