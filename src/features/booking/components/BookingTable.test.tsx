// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Invoice } from "@/features/invoice/invoice";
import BookingTable from "./BookingTable";

const booking = {
  id: "booking-1",
  customerId: "customer-1",
  serviceId: "service-1",
  customerName: "Ayu",
  serviceName: "Wedding Makeup",
  sessions: [{ id: "session-1", bookingId: "booking-1", sequence: 1, label: "", startAt: "2026-08-20T02:00:00.000Z", endAt: "2026-08-20T04:00:00.000Z", location: "Studio", notes: "", createdAt: 1, updatedAt: 1 }],
  servicePrice: 7_500_000,
  additionalCharges: [],
  bookingStatus: "Scheduled" as const,
  fullPaymentDueDate: "2026-08-19",
  notes: "",
  createdAt: 1,
  updatedAt: 1,
  paymentStatus: "Outstanding" as const,
  totalPaid: 0,
  remainingAmount: 7_500_000,
  directExpenses: 0,
  estimatedProfit: 7_500_000,
  cashPosition: 0,
};

function issuedInvoice(id: string, number: string, updatedAt: number): Invoice {
  return {
    id,
    businessId: "local-business",
    bookingId: booking.id,
    clientId: booking.customerId,
    lifecycle: "Issued",
    rootInvoiceId: id,
    previousVersionId: null,
    version: 1,
    invoiceNumber: number,
    clientName: booking.customerName,
    clientPhone: "",
    clientEmail: "",
    serviceName: booking.serviceName,
    invoiceDate: "2026-08-14",
    dueDate: "2026-08-19",
    lineItems: [{ id: `${id}-item`, item: booking.serviceName, description: "", quantity: 1, unitPrice: booking.servicePrice }],
    discount: 0,
    tax: 0,
    discountMode: "none",
    discountValue: 0,
    taxPercent: 0,
    invoiceStyle: "Neutral",
    paymentInstructions: "",
    notes: "",
    schedules: [],
    showSchedules: true,
    snapshot: null,
    createdAt: updatedAt,
    updatedAt,
    issuedAt: updatedAt,
  };
}

const callbacks = {
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(() => true),
  onStatusChange: vi.fn(() => true),
  onFinancialDetailsClick: vi.fn(),
  sort: "newest" as const,
  onSortChange: vi.fn(),
};

afterEach(cleanup);

describe("BookingTable invoice summary", () => {
  it("renders the centralized Overdue payment status in desktop and mobile booking views", () => {
    render(<BookingTable bookings={[{ ...booking, paymentStatus: "Overdue" }]} invoices={[]} timezone="Asia/Jakarta" {...callbacks} />);
    expect(screen.getAllByText("Overdue")).toHaveLength(2);
  });

  it("offers booking-linked invoice actions from the shared row menu and hides zero expense noise", async () => {
    const user = userEvent.setup();
    render(<BookingTable bookings={[booking]} invoices={[]} timezone="Asia/Jakarta" {...callbacks} />);

    await user.click(screen.getAllByRole("button", { name: "Actions for Ayu's booking" })[0]);
    expect(screen.getByRole("menuitem", { name: "Create invoice draft" }).getAttribute("href")).toBe("/invoices?booking=booking-1&action=create");
    expect(screen.getByRole("menuitem", { name: "Issue invoice" }).getAttribute("href")).toBe("/invoices?booking=booking-1&action=issue");
    expect(screen.queryByText("Expenses: Rp 0")).toBeNull();
  });

  it("summarizes multiple invoices and keeps issued actions in the row menu", async () => {
    const user = userEvent.setup();
    const invoices = [issuedInvoice("invoice-1", "INV-2026-001", 1), issuedInvoice("invoice-2", "INV-2026-002", 2)];
    render(<BookingTable bookings={[booking]} invoices={invoices} timezone="Asia/Jakarta" {...callbacks} />);

    expect(screen.getAllByRole("link", { name: "2 invoices · Latest INV-2026-002" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Actions for Ayu's booking" })[0]);
    expect(screen.getByRole("menuitem", { name: "Download invoice" }).getAttribute("href")).toBe("/invoices?invoice=invoice-2&action=download");
  });
});
