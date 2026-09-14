// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OperationalAttentionItem } from "@/features/attention/operationalAttention";
import NeedsAttention from "./NeedsAttention";

const overdue: OperationalAttentionItem = {
  id: "overdue-payment:booking-1",
  type: "overdue-payment",
  priority: "critical",
  title: "Ayu has an overdue payment",
  explanation: "Portrait · payment was due 2026-09-10",
  amount: 4_500_000,
  date: "2026-09-10",
  targetHref: "/bookings?booking=booking-1",
  actions: ["message-client", "record-payment", "open-booking"],
  bookingId: "booking-1",
  customerId: "customer-1",
  requestId: null,
  customerName: "Ayu",
  customerPhone: "081234567890",
  customerEmail: "ayu@example.com",
  serviceName: "Portrait",
  bookingDate: "2026-09-20",
  dueDate: "2026-09-10",
  bookingValue: 5_000_000,
  totalPaid: 500_000,
  remainingAmount: 4_500_000,
};

describe("NeedsAttention", () => {
  it("shows canonical record actions instead of aggregate-only links", () => {
    const { unmount } = render(<NeedsAttention items={[overdue]} businessName="Qai Studio" />);

    expect(screen.getByRole("heading", { name: "Needs attention" })).toBeTruthy();
    expect(screen.getByText("Rp 4.500.000 remaining")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Message client" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record payment" }).getAttribute("href")).toBe("/bookings?booking=booking-1&action=payment");
    expect(screen.getByRole("button", { name: "Open booking" }).getAttribute("href")).toBe("/bookings?booking=booking-1");
    unmount();
  });

  it("uses a calm state when nothing needs attention", () => {
    const { unmount } = render(<NeedsAttention items={[]} businessName="Qai Studio" />);
    expect(screen.getByText("You’re up to date.")).toBeTruthy();
    unmount();
  });
});
