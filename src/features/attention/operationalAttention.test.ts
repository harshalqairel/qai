import { describe, expect, it } from "vitest";
import type { Booking } from "@/features/booking/types";
import type { Customer } from "@/features/customer/types";
import type { Payment } from "@/features/payment/types";
import type { PublicRequest } from "@/features/qai-page/validation";
import type { Service } from "@/features/service/types";
import { buildOperationalAttentionItems } from "./operationalAttention";

const customer: Customer = { id: "customer-1", name: "Ayu", phone: "081234567890", email: "ayu@example.com", instagram: "", notes: "", createdAt: 1 };
const service = { id: "service-1", name: "Portrait" } as Service;

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    customerId: customer.id,
    serviceId: service.id,
    servicePrice: 1_000_000,
    additionalCharges: [],
    sessions: [{ id: "session-1", bookingId: "booking-1", sequence: 1, label: "", startAt: "2026-09-15T03:00:00.000Z", endAt: "2026-09-15T04:00:00.000Z", location: "Studio", notes: "", createdAt: 1, updatedAt: 1 }],
    bookingStatus: "Scheduled",
    fullPaymentDueDate: "2026-09-13",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function payment(amount: number): Payment {
  return { id: `payment-${amount}`, bookingId: "booking-1", amount, date: "2026-09-10", method: "Bank Transfer", notes: "", createdAt: 1 };
}

function request(overrides: Partial<PublicRequest> = {}): PublicRequest {
  return {
    id: "request-1", pageId: "page-1", slug: "studio", serviceId: service.id, serviceName: service.name,
    type: "Booking request", submissionId: "submission-1", clientId: null, serviceVariantId: null, serviceSnapshot: null,
    questionnaireResponses: [], clientName: "Rani", whatsapp: "081298765432", email: "", instagram: "", location: "",
    schedules: [], need: "", budget: "", notes: "", status: "Pending", submittedAt: 1, updatedAt: 1,
    bookingId: null, instantSlotId: null, ...overrides,
  };
}

function build(bookings: Booking[], payments: Payment[] = [], requests: PublicRequest[] = []) {
  return buildOperationalAttentionItems({ bookings, payments, customers: [customer], services: [service], requests, todayKey: "2026-09-14", timezone: "Asia/Jakarta" });
}

describe("operational attention domain", () => {
  it("derives overdue, due-soon, and tomorrow work from canonical state", () => {
    expect(build([booking()]).map((item) => item.type)).toEqual(["overdue-payment", "booking-tomorrow"]);
    expect(build([booking({ fullPaymentDueDate: "2026-09-16" })]).map((item) => item.type)).toEqual(["payment-due-soon", "booking-tomorrow"]);
  });

  it("automatically excludes paid and cancelled payment work", () => {
    expect(build([booking()], [payment(1_000_000)]).map((item) => item.type)).toEqual(["booking-tomorrow"]);
    expect(build([booking({ bookingStatus: "Cancelled" })]).map((item) => item.type)).toEqual([]);
  });

  it("does not surface completed work as an upcoming booking", () => {
    expect(build([booking({ bookingStatus: "Completed", fullPaymentDueDate: "" })])).toEqual([]);
  });

  it("uses persisted Service price plus Additional Charges for attention balances", () => {
    const withCharge = booking({
      additionalCharges: [{
        id: "charge-1", bookingId: "booking-1", sessionId: null, categoryId: "category-1",
        categoryName: "Travel", description: "", amount: 250_000, createdAt: 1, updatedAt: 1,
      }],
    });
    const overdue = build([withCharge], [payment(400_000)]).find((item) => item.type === "overdue-payment");
    expect(overdue).toMatchObject({ bookingValue: 1_250_000, totalPaid: 400_000, remainingAmount: 850_000, amount: 850_000 });
  });

  it("deduplicates a multi-session Booking into one tomorrow item", () => {
    const multi = booking({ sessions: [
      { ...booking().sessions[0], id: "session-past", sequence: 1, startAt: "2026-09-10T03:00:00.000Z", endAt: "2026-09-10T04:00:00.000Z" },
      { ...booking().sessions[0], id: "session-2", sequence: 2, startAt: "2026-09-15T07:00:00.000Z", endAt: "2026-09-15T08:00:00.000Z" },
    ] });
    const tomorrow = build([multi]).filter((item) => item.type === "booking-tomorrow");
    expect(tomorrow).toHaveLength(1);
    expect(tomorrow[0].bookingDate).toBe("2026-09-15 · 14:00");
  });

  it("distinguishes pending requests from accepted requests needing link recovery", () => {
    const recovered = booking({ id: "recovered-booking", capacitySourceRequestId: "request-2", sessions: [], fullPaymentDueDate: "" });
    const items = build([recovered], [], [request(), request({ id: "request-2", status: "Accepted", clientId: customer.id })]);
    expect(items.map((item) => item.type)).toEqual(["request-recovery", "pending-request"]);
    expect(items[0].targetHref).toBe("/space?tab=Requests&request=request-2");
    expect(items[0]).toMatchObject({ bookingId: "recovered-booking", customerId: customer.id });
    expect(items[0].explanation).toContain("Booking exists");
  });

  it("does not falsely claim a Booking exists for an accepted unlinked request with no source Booking", () => {
    const item = build([], [], [request({ status: "Accepted" })])[0];
    expect(item.bookingId).toBeNull();
    expect(item.explanation).toContain("no linked Booking yet");
  });

  it("uses deterministic priority, date, type, and stable-ID ordering", () => {
    const items = build([
      booking({ id: "booking-b", fullPaymentDueDate: "2026-09-12", sessions: [] }),
      booking({ id: "booking-a", fullPaymentDueDate: "2026-09-12", sessions: [] }),
    ], [], [request()]);
    expect(items.map((item) => item.id)).toEqual([
      "overdue-payment:booking-a",
      "overdue-payment:booking-b",
      "pending-request:request-1",
    ]);
  });
});
