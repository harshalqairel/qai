// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
};

describe("BookingTable invoice summary", () => {
  it("offers a booking-linked draft and hides zero expense noise", () => {
    render(<BookingTable bookings={[booking]} invoices={[]} timezone="Asia/Jakarta" {...callbacks} />);

    expect(screen.getAllByRole("button", { name: "Create draft" })[0].getAttribute("href")).toBe("/invoices?booking=booking-1&action=create");
    expect(screen.getAllByRole("link", { name: "Issue invoice" })[0].getAttribute("href")).toBe("/invoices?booking=booking-1&action=issue");
    expect(screen.queryByText("Expenses: Rp 0")).toBeNull();
  });

  it("summarizes multiple invoices using the latest issued number", () => {
    const invoices = [issuedInvoice("invoice-1", "INV-2026-001", 1), issuedInvoice("invoice-2", "INV-2026-002", 2)];
    render(<BookingTable bookings={[booking]} invoices={invoices} timezone="Asia/Jakarta" {...callbacks} />);

    expect(screen.getAllByRole("link", { name: "2 invoices · Latest INV-2026-002" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Download PDF" })[0].getAttribute("href")).toBe("/invoices?invoice=invoice-2&action=download");
  });
});
