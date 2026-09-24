// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InvoicePage from "./InvoicePage";
import { invoiceRepository, invoiceTotals } from "./invoice";

const hookData = vi.hoisted(() => ({
  bookings: [{
    id: "booking-1",
    customerId: "customer-1",
    serviceId: "service-1",
    sessions: [{
      id: "session-1",
      bookingId: "booking-1",
      sequence: 1,
      label: "Main",
      startAt: "2026-09-15T03:00:00.000Z",
      endAt: "2026-09-15T04:00:00.000Z",
      location: "Studio",
      notes: "",
      createdAt: 1,
      updatedAt: 1,
    }],
    servicePrice: 500_000,
    serviceSnapshot: null,
    additionalCharges: [{ id: "charge-1", bookingId: "booking-1", sessionId: null, categoryId: "category-1", categoryName: "Location", description: "", amount: 75_000, createdAt: 1, updatedAt: 1 }],
    questionnaireResponses: [],
    capacitySourceRequestId: null,
    capacitySlotKeys: [],
    bookingStatus: "Scheduled" as const,
    fullPaymentDueDate: "2026-09-15",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
  }],
  customers: [{ id: "customer-1", name: "Booking Save QA", phone: "080000000001", instagram: "", email: "", notes: "", createdAt: 1 }],
  services: [{ id: "service-1", name: "Booking Save Service", categoryId: "category-1", price: 500_000, duration: 60, defaultSessionCount: 1, description: "", active: true }],
}));

vi.mock("@/features/booking/hooks/useBookings", () => ({
  useBookings: () => ({ bookings: hookData.bookings, isLoading: false }),
}));
vi.mock("@/features/customer/hooks/useCustomers", () => ({
  useCustomers: () => ({ customers: hookData.customers, isLoading: false }),
}));
vi.mock("@/features/service/hooks/useServices", () => ({
  useServices: () => ({ services: hookData.services, isLoading: false }),
}));
vi.mock("@/features/payment/hooks/usePayments", () => ({
  usePayments: () => ({ payments: [] }),
}));

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, "", "/invoices");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("InvoicePage new invoice flow", () => {
  it("formats unit prices while preserving empty editing, numeric values, and totals", async () => {
    const user = userEvent.setup();
    render(<InvoicePage />);

    await user.click(screen.getAllByRole("button", { name: "New invoice" })[0]!);
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    await user.click(screen.getByRole("button", { name: /Booking Save QA Booking Save Service/ }));

    const servicePrice = screen.getByRole("textbox", { name: "Unit price for item 1" }) as HTMLInputElement;
    const chargePrice = screen.getByRole("textbox", { name: "Unit price for item 2" }) as HTMLInputElement;
    expect(servicePrice.value).toBe("500.000");
    expect(chargePrice.value).toBe("75.000");
    expect(screen.getAllByText("Rp 575.000").length).toBeGreaterThan(0);

    await user.click(servicePrice);
    await user.clear(servicePrice);
    expect(servicePrice.value).toBe("");
    expect(screen.getByText("Amount: Rp 500.000")).toBeTruthy();

    await user.type(servicePrice, "600000");
    expect(servicePrice.value).toBe("600.000");
    expect(chargePrice.value).toBe("75.000");
    expect(screen.getByText("Amount: Rp 600.000")).toBeTruthy();
    expect(screen.getAllByText("Rp 675.000").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    const saved = invoiceRepository.getAll()[0]!;
    expect(saved.lineItems.map((item) => item.unitPrice)).toEqual([600_000, 75_000]);
    expect(invoiceTotals(saved).total).toBe(675_000);
  });

  it("keeps keyboard insertion at the logical caret position in a grouped price", async () => {
    const user = userEvent.setup();
    render(<InvoicePage />);
    await user.click(screen.getAllByRole("button", { name: "New invoice" })[0]!);
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    await user.click(screen.getByRole("button", { name: /Booking Save QA Booking Save Service/ }));

    const price = screen.getByRole("textbox", { name: "Unit price for item 1" }) as HTMLInputElement;
    await user.click(price);
    price.setSelectionRange(1, 1);
    await user.keyboard("9");
    expect(price.value).toBe("5.900.000");
    expect(price.value.slice(0, price.selectionStart ?? 0).replace(/\D/g, "")).toBe("59");
    await user.keyboard("{Tab}");
    expect(price.value).toBe("5.900.000");
  });

  it("keeps the grouped value stable when editing a separator", async () => {
    const user = userEvent.setup();
    render(<InvoicePage />);
    await user.click(screen.getAllByRole("button", { name: "New invoice" })[0]!);
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    await user.click(screen.getByRole("button", { name: /Booking Save QA Booking Save Service/ }));

    const price = screen.getByRole("textbox", { name: "Unit price for item 1" }) as HTMLInputElement;
    await user.click(price);
    price.setSelectionRange(4, 4);
    await user.keyboard("{Backspace}");
    expect(price.value).toBe("500.000");
    expect(price.value.slice(0, price.selectionStart ?? 0).replace(/\D/g, "")).toBe("500");
  });

  it("keeps an entered fractional price exact without changing the calculation", async () => {
    const user = userEvent.setup();
    render(<InvoicePage />);
    await user.click(screen.getAllByRole("button", { name: "New invoice" })[0]!);
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    await user.click(screen.getByRole("button", { name: /Booking Save QA Booking Save Service/ }));

    const price = screen.getByRole("textbox", { name: "Unit price for item 1" }) as HTMLInputElement;
    await user.clear(price);
    await user.type(price, "600000,25");
    expect(price.value).toBe("600.000,25");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    const saved = invoiceRepository.getAll()[0]!;
    expect(saved.lineItems[0].unitPrice).toBe(600_000.25);
    expect(invoiceTotals(saved).total).toBe(675_000.25);
  });

  it("uses one modal layer and opens a booking-linked invoice when the booking is clicked", async () => {
    const user = userEvent.setup();
    render(<InvoicePage />);

    await user.click(screen.getAllByRole("button", { name: "New invoice" })[0]!);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "New invoice" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "New invoice" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Choose a booking" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Booking Save QA Booking Save Service/ }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Choose a booking" })).toBeNull();
      expect(screen.getByRole("heading", { name: "Booking invoice" })).toBeTruthy();
      expect(screen.getAllByRole("dialog")).toHaveLength(1);
    });
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("activates a booking with the %s key", async (_label, key) => {
    const user = userEvent.setup();
    render(<InvoicePage />);

    await user.click(screen.getAllByRole("button", { name: "New invoice" })[0]!);
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    const booking = screen.getByRole("button", { name: /Booking Save QA Booking Save Service/ });
    booking.focus();
    await user.keyboard(key);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Booking invoice" })).toBeTruthy();
    });
  });

  it("closes the booking chooser with Escape and restores focus to its opener", async () => {
    const user = userEvent.setup();
    render(<InvoicePage />);

    const opener = screen.getAllByRole("button", { name: "New invoice" })[0]!;
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: /From a booking/ }));
    expect(screen.getByRole("heading", { name: "Choose a booking" })).toBeTruthy();

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Choose a booking" })).toBeNull();
      expect(document.activeElement).toBe(opener);
    });
  });
});
