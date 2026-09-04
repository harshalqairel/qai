// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EnrichedBooking } from "@/features/dashboard/hooks/useDashboard";
import type { DerivedPaymentStatus } from "@/features/payment/types";
import PaymentDueList from "./PaymentDueList";

const push = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/reminder/components/ReminderActions", () => ({ default: () => null }));
vi.mock("@/features/reminder/components/LastReminderStatus", () => ({ default: () => null }));

function booking(paymentStatus: DerivedPaymentStatus): EnrichedBooking {
  return {
    id: `booking-${paymentStatus}`,
    customerId: "customer-1",
    serviceId: "service-1",
    sessions: [{
      id: "session-1",
      bookingId: `booking-${paymentStatus}`,
      sequence: 1,
      label: "",
      startAt: "2026-09-10T03:00:00.000Z",
      endAt: "2026-09-10T04:00:00.000Z",
      location: "Studio",
      notes: "",
      createdAt: 1,
      updatedAt: 1,
    }],
    servicePrice: 8_000_000,
    bookingStatus: paymentStatus === "Cancelled" ? "Cancelled" : "Scheduled",
    fullPaymentDueDate: paymentStatus === "Overdue" ? "2026-09-01" : "2026-09-10",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
    customerName: `Client ${paymentStatus}`,
    customerPhone: "",
    customerEmail: "",
    serviceName: "Consultation",
    totalPaid: paymentStatus === "Partial Paid" ? 3_000_000 : paymentStatus === "Fully Paid" ? 8_000_000 : 0,
    remainingAmount: paymentStatus === "Fully Paid" || paymentStatus === "Cancelled" ? 0 : 5_000_000,
    paymentStatus,
  };
}

function renderList(item: EnrichedBooking, late = false) {
  return render(
    <PaymentDueList
      title={late ? "Overdue payments" : "Payments due soon"}
      description="Payment status"
      emptyMessage="None"
      items={[item]}
      late={late}
      todayKey="2026-09-03"
      businessName="Qai"
      timezone="Asia/Jakarta"
    />,
  );
}

describe("PaymentDueList deep links", () => {
  beforeEach(() => push.mockReset());

  it.each([
    ["Outstanding", "/bookings?payment=outstanding&booking=booking-Outstanding"],
    ["Partial Paid", "/bookings?payment=partial&booking=booking-Partial+Paid"],
  ] as const)("opens a %s Dashboard booking with its matching filter", (status, expected) => {
    const item = booking(status);
    const { unmount } = renderList(item);
    fireEvent.click(screen.getByRole("link", { name: new RegExp(`Client ${status}`) }));
    expect(push).toHaveBeenCalledWith(expected);
    unmount();
  });

  it("opens an overdue Dashboard booking with Overdue active and its ID preserved", () => {
    const item = booking("Overdue");
    renderList(item, true);
    fireEvent.click(screen.getByRole("link", { name: /Client Overdue/ }));
    expect(push).toHaveBeenCalledWith("/bookings?payment=overdue&booking=booking-Overdue");
  });
});
