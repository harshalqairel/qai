// @vitest-environment happy-dom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BookingSaveError } from "@/features/booking/domain/bookingSaveError";
import type { CreateBookingCommand } from "@/features/booking/types";
import { useBookings } from "./useBookings";

const cloudMocks = vi.hoisted(() => ({
  create: vi.fn(),
  getAll: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isCloudModeEnabled: () => true }));
vi.mock("@/lib/supabase/cloudRepositories", () => ({
  cloudBookingRepository: cloudMocks,
  getActiveBusinessContext: vi.fn(async () => ({
    businessId: "business-1",
    timezone: "Asia/Jakarta",
  })),
}));
vi.mock("@/lib/dataRefresh", () => ({
  emitDataRefresh: vi.fn(),
  subscribeToDataRefresh: vi.fn(() => () => undefined),
}));
vi.mock("@/features/calendar/calendarIncrementalSync", () => ({
  calendarRelevantSessionIds: vi.fn(() => []),
  synchronizeAffectedCalendarSessions: vi.fn(async () => undefined),
}));

const command: CreateBookingCommand = {
  requestId: "request-1",
  booking: {
    customerId: "customer-1",
    serviceId: "service-1",
    sessions: [{
      date: "2026-09-16",
      startTime: "10:00",
      endTime: "11:00",
      label: "",
      location: "Online",
      notes: "",
    }],
    servicePrice: 50_000,
    serviceSnapshot: null,
    questionnaireResponses: [],
    capacitySourceRequestId: null,
    capacitySlotKeys: [],
    bookingStatus: "Scheduled",
    fullPaymentDueDate: "2026-09-16",
    notes: "",
  },
  initialPayment: null,
  additionalCharges: [{
    sessionId: null,
    categoryId: "charge-category-7",
    categoryName: "Extra assistant",
    description: "",
    amount: 25_000,
  }],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  cloudMocks.getAll.mockResolvedValue([]);
});

describe("useBookings cloud save errors", () => {
  it("passes the exact Booking price and charge to cloud persistence and does not swallow its safe error", async () => {
    const failure = new BookingSaveError(
      "The Additional Charge category could not be saved.",
      { operation: "save_booking_with_integrity", code: "22P02", status: 400 },
    );
    cloudMocks.getAll.mockResolvedValue([]);
    cloudMocks.create.mockRejectedValue(failure);
    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.createBookingOrThrow(command)).rejects.toBe(failure);
    expect(cloudMocks.create).toHaveBeenCalledWith(expect.objectContaining({
      servicePrice: 50_000,
      additionalCharges: [expect.objectContaining({
        categoryId: "charge-category-7",
        categoryName: "Extra assistant",
        amount: 25_000,
      })],
    }));
  });
});
