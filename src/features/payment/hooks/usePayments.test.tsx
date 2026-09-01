// @vitest-environment happy-dom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentSaveError } from "@/features/payment/domain/paymentSaveError";
import { usePayments } from "./usePayments";

const cloudMocks = vi.hoisted(() => ({
  create: vi.fn(),
  getAll: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isCloudModeEnabled: () => true }));
vi.mock("@/lib/supabase/cloudRepositories", () => ({ cloudPaymentRepository: cloudMocks }));
vi.mock("@/lib/dataRefresh", () => ({
  emitDataRefresh: vi.fn(),
  subscribeToDataRefresh: vi.fn(() => () => undefined),
}));

const input = {
  bookingId: "booking-1",
  date: "2026-08-31",
  amount: 25_000,
  method: "Bank Transfer" as const,
  notes: "Deposit",
};

beforeEach(() => {
  vi.clearAllMocks();
  cloudMocks.getAll.mockResolvedValue([]);
});

afterEach(cleanup);

describe("usePayments cloud error propagation", () => {
  it("exposes the safe database failure through the throw-capable API", async () => {
    const failure = new PaymentSaveError(
      "The amount exceeds this booking's outstanding balance.",
      { operation: "create_payment", code: "P0001", status: 400 },
    );
    cloudMocks.create.mockRejectedValue(failure);
    const { result } = renderHook(() => usePayments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(result.current.createPaymentOrThrow(input)).rejects.toBe(failure);
    await expect(result.current.createPayment(input)).resolves.toBe(false);
  });

  it("adds the canonical Payment only after cloud persistence succeeds", async () => {
    cloudMocks.create.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePayments());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await expect(result.current.createPaymentOrThrow(input)).resolves.toBe(true);
    });
    await waitFor(() => expect(result.current.payments).toEqual([expect.objectContaining(input)]));
  });
});
