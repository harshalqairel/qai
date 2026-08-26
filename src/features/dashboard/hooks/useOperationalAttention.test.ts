import { describe, expect, it } from "vitest";

import type { Booking } from "@/features/booking/types";
import type { Payment } from "@/features/payment/types";
import type { PublicRequest } from "@/features/qai-page/validation";
import { buildOperationalAttention, isPendingPublicRequest } from "./useOperationalAttention";

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: "booking-1",
  customerId: "customer-1",
  serviceId: "service-1",
  sessions: [],
  servicePrice: 2_000_000,
  additionalCharges: [],
  questionnaireResponses: [],
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "2026-08-20",
  notes: "",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const payment = (amount: number): Payment => ({
  id: "payment-1",
  bookingId: "booking-1",
  amount,
  date: "2026-08-10",
  method: "Bank Transfer",
  notes: "",
  createdAt: 1,
});

const request = (overrides: Partial<PublicRequest> = {}): PublicRequest => ({
  id: "request-1",
  pageId: "page-1",
  slug: "studio",
  serviceId: "service-1",
  serviceName: "Portrait",
  type: "Booking request",
  submissionId: "submission-1",
  clientId: null,
  serviceVariantId: null,
  serviceSnapshot: null,
  questionnaireResponses: [],
  clientName: "Sarah",
  whatsapp: "0812",
  email: "",
  instagram: "",
  location: "",
  schedules: [],
  need: "",
  budget: "",
  notes: "",
  status: "Pending",
  submittedAt: 1,
  updatedAt: 1,
  bookingId: null,
  instantSlotId: null,
  ...overrides,
});

describe("operational attention", () => {
  it("uses remaining balances and pending requests without counting cancelled bookings", () => {
    const result = buildOperationalAttention(
      [booking(), booking({ id: "cancelled", bookingStatus: "Cancelled" })],
      [payment(500_000)],
      "2026-08-24",
      [request()],
    );

    expect(result).toEqual({ overdueCount: 1, overdueAmount: 1_500_000, requestCount: 1, attentionCount: 2 });
  });

  it("recognizes the same actionable request states used by the owner review flow", () => {
    expect(isPendingPublicRequest(request())).toBe(true);
    expect(isPendingPublicRequest(request({ status: "Accepted" }))).toBe(true);
    expect(isPendingPublicRequest(request({ status: "Accepted", type: "Instant booking", bookingId: null }))).toBe(true);
    expect(isPendingPublicRequest(request({ status: "Accepted", type: "Instant booking", bookingId: "booking-1" }))).toBe(false);
  });
});
