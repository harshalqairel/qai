// @vitest-environment happy-dom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BookingsPage from "./page";

const hookState = vi.hoisted(() => ({
  customerLoading: true,
  customers: [] as Array<{
    id: string;
    name: string;
    phone: string;
    instagram: string;
    email: string;
    notes: string;
    createdAt: number;
  }>,
}));

const booking = {
  id: "booking-1",
  customerId: "customer-1",
  serviceId: "service-1",
  sessions: [{
    id: "session-1",
    bookingId: "booking-1",
    sequence: 0,
    label: "",
    startAt: "2026-09-16T03:00:00.000Z",
    endAt: "2026-09-16T04:00:00.000Z",
    location: "Studio",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
  }],
  servicePrice: 100_000,
  serviceSnapshot: null,
  additionalCharges: [],
  questionnaireResponses: [],
  capacitySourceRequestId: null,
  capacitySlotKeys: [],
  bookingStatus: "Scheduled" as const,
  fullPaymentDueDate: "2026-09-16",
  notes: "",
  createdAt: 1,
  updatedAt: 1,
};

const retry = vi.fn();

vi.mock("@/features/booking/hooks/useBookings", () => ({
  useBookings: () => ({
    bookings: [booking],
    createBookingOrThrow: vi.fn(),
    updateBooking: vi.fn(),
    updateBookingOrThrow: vi.fn(),
    deleteBooking: vi.fn(),
    updateAdditionalCharges: vi.fn(),
    timezone: "Asia/Jakarta",
    isLoading: false,
    loadError: false,
    retry,
  }),
}));

vi.mock("@/features/customer/hooks/useCustomers", () => ({
  useCustomers: () => ({
    customers: hookState.customers,
    createCustomerAndReturn: vi.fn(),
    isLoading: hookState.customerLoading,
    loadError: false,
    retry,
  }),
}));

vi.mock("@/features/service/hooks/useServices", () => ({
  useServices: () => ({
    services: [{
      id: "service-1",
      name: "Portrait session",
      categoryId: "category-1",
      price: 100_000,
      duration: 60,
      defaultSessionCount: 1,
      description: "",
      active: true,
    }],
    createServiceAndReturn: vi.fn(),
    isLoading: false,
    loadError: false,
    retry,
  }),
}));

vi.mock("@/features/payment/hooks/usePayments", () => ({
  usePayments: () => ({
    payments: [],
    createPayment: vi.fn(),
    updatePayment: vi.fn(),
    deletePayment: vi.fn(),
    isLoading: false,
    loadError: false,
    retry,
  }),
}));

vi.mock("@/features/expense/hooks/useExpenses", () => ({
  useExpenses: () => ({
    expenses: [],
    createExpense: vi.fn(),
    updateExpense: vi.fn(),
    isLoading: false,
    loadError: false,
    retry,
  }),
}));

vi.mock("@/features/expense-category/hooks/useExpenseCategories", () => ({
  useExpenseCategories: () => ({
    categories: [],
    createCategoryAndReturn: vi.fn(),
    isLoading: false,
    loadError: false,
    retry,
  }),
}));

vi.mock("@/features/service-category/hooks/useServiceCategories", () => ({
  useServiceCategories: () => ({
    categories: [],
    createCategoryAndReturn: vi.fn(),
    isLoading: false,
    loadError: false,
    retry,
  }),
}));

vi.mock("@/lib/supabase/config", () => ({
  isCloudModeEnabled: () => false,
  isValidationModeEnabled: () => false,
}));

vi.mock("@/features/invoice/invoice", () => ({
  invoiceRepository: { getAll: () => [] },
  latestInvoiceVersions: () => [],
}));

vi.mock("@/components/system/PageSkeleton", () => ({ default: () => <div>Loading bookings</div> }));
vi.mock("@/components/system/DataErrorState", () => ({ default: () => <div>Data error</div> }));
vi.mock("@/features/booking/components/BookingHeader", () => ({ default: () => null }));
vi.mock("@/features/booking/components/BookingToolbar", () => ({ default: () => null }));
vi.mock("@/features/booking/components/BookingTable", () => ({ default: () => null }));
vi.mock("@/features/booking/components/BookingDialog", () => ({ default: () => null }));
vi.mock("@/features/booking/components/BulkServiceChangeDialog", () => ({ default: () => null }));
vi.mock("@/features/payment/components/PaymentDialog", () => ({ default: () => null }));
vi.mock("@/features/expense/components/ExpenseDialog", () => ({ default: () => null }));
vi.mock("@/components/system/BulkActionBar", () => ({ default: () => null }));
vi.mock("@/features/booking/components/BookingFinancialDetailsDialog", () => ({
  default: ({ open, booking: selected }: { open: boolean; booking: { customerName: string } | null }) =>
    open && selected ? <div data-testid="financial-details">{selected.customerName}</div> : null,
}));

afterEach(() => {
  cleanup();
  hookState.customerLoading = true;
  hookState.customers = [];
  window.history.replaceState(null, "", "/bookings");
  vi.clearAllMocks();
});

describe("BookingsPage deep links", () => {
  it("waits for related Client data before opening Booking financial details", async () => {
    window.history.replaceState(null, "", "/bookings?booking=booking-1");
    const view = render(<BookingsPage />);

    expect(screen.getByText("Loading bookings")).toBeDefined();
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)); });
    expect(screen.queryByTestId("financial-details")).toBeNull();

    hookState.customers = [{
      id: "customer-1",
      name: "Client A",
      phone: "+62000000000",
      instagram: "",
      email: "client-a@example.invalid",
      notes: "",
      createdAt: 1,
    }];
    hookState.customerLoading = false;
    view.rerender(<BookingsPage />);

    await waitFor(() => expect(screen.getByTestId("financial-details").textContent).toBe("Client A"));
  });
});
