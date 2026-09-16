// @vitest-environment happy-dom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { BookingFinancialDetails } from "./BookingFinancialDetailsDialog";

vi.mock("@/features/communication/components/CommunicationHistoryList", () => ({
  default: () => <section aria-label="Communication history" />,
}));
vi.mock("@/features/invoice/invoice", () => ({
  invoiceRepository: { getAll: () => [] },
  latestInvoiceVersions: () => [],
}));
vi.mock("@/features/booking/domain/additionalChargeCategories", () => ({
  getAdditionalChargeCategories: () => [],
  loadAdditionalChargeCategories: async () => [],
  createAdditionalChargeCategoryPersistent: vi.fn(),
}));

import BookingFinancialDetailsDialog from "./BookingFinancialDetailsDialog";

const booking: BookingFinancialDetails = {
  id: "booking-1",
  customerId: "customer-1",
  serviceId: "service-1",
  customerName: "Ayu",
  customerPhone: "08123456789",
  customerEmail: "ayu@example.com",
  serviceName: "Wedding Makeup",
  sessions: [{
    id: "session-1",
    bookingId: "booking-1",
    sequence: 1,
    label: "Ceremony",
    startAt: "2026-09-20T03:00:00.000Z",
    endAt: "2026-09-20T05:00:00.000Z",
    location: "Studio",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
  }],
  servicePrice: 7_500_000,
  additionalCharges: [],
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "2026-09-18",
  notes: "",
  createdAt: 1,
  updatedAt: 1,
  paymentStatus: "Outstanding",
  totalPaid: 2_000_000,
  remainingAmount: 5_500_000,
  directExpenses: 500_000,
  estimatedProfit: 7_000_000,
  cashPosition: 1_500_000,
};

afterEach(cleanup);

describe("BookingFinancialDetailsDialog nested Message Client flow", () => {
  it("keeps Message Client topmost and returns focus to the still-open Payment Details dialog", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <BookingFinancialDetailsDialog
        open
        booking={booking}
        payments={[]}
        businessName="Qai Studio"
        timezone="Asia/Jakarta"
        onClose={onClose}
        onAddPayment={vi.fn()}
        onAddExpense={vi.fn()}
        onUpdateAdditionalCharges={vi.fn().mockResolvedValue(true)}
      />,
    );

    const paymentDialog = screen.getByRole("dialog", { name: "Payment Details" });
    const messageButton = within(paymentDialog).getAllByRole("button", { name: "Message client" })[0];
    await user.click(messageButton);

    const messageDialog = screen.getByRole("dialog", { name: "Message Ayu" });
    const dialogStack = Array.from(document.querySelectorAll<HTMLElement>("[data-slot='dialog-content']"));
    expect(dialogStack).toEqual([paymentDialog, messageDialog]);
    expect(messageDialog.contains(document.activeElement)).toBe(true);
    expect(screen.getAllByRole("dialog", { hidden: true })).toHaveLength(2);
    expect(screen.getAllByRole("dialog")).toEqual([messageDialog]);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Message Ayu" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Payment Details" })).toBeTruthy();
    expect(document.activeElement).toBe(messageButton);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(messageButton);
    const reopenedMessageDialog = screen.getByRole("dialog", { name: "Message Ayu" });
    await user.click(within(reopenedMessageDialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Message Ayu" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Payment Details" })).toBeTruthy();
    expect(document.activeElement).toBe(messageButton);
    expect(onClose).not.toHaveBeenCalled();
  });
});
