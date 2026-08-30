// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import InvoicePage from "./InvoicePage";

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
    servicePrice: 50_000,
    serviceSnapshot: null,
    additionalCharges: [],
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
  services: [{ id: "service-1", name: "Booking Save Service", categoryId: "category-1", price: 50_000, duration: 60, defaultSessionCount: 1, description: "", active: true }],
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
