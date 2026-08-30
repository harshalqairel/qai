import { afterEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/features/booking/types";
import { createClient } from "./client";
import { bookingToCloudPayload, cloudBookingRepository } from "./cloudRepositories";

vi.mock("./client", () => ({ createClient: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

function booking(changes: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1", customerId: "customer-1", serviceId: "service-1", servicePrice: 50_000,
    serviceSnapshot: null, sessions: [{
      id: "session-1", bookingId: "booking-1", sequence: 1, label: "",
      startAt: "2026-08-31T03:00:00.000Z", endAt: "2026-08-31T04:00:00.000Z",
      location: "Online", notes: "", createdAt: 1, updatedAt: 1,
    }], additionalCharges: [], questionnaireResponses: [], capacitySourceRequestId: null,
    capacitySlotKeys: [], bookingStatus: "Scheduled", fullPaymentDueDate: "2026-08-31",
    notes: "", createdAt: 1, updatedAt: 1, ...changes,
  };
}

describe("cloud Booking payload", () => {
  it("persists the captured Booking price and a legitimate zero exactly", () => {
    expect(bookingToCloudPayload(booking()).service_price).toBe(50_000);
    expect(bookingToCloudPayload(booking({ servicePrice: 0 })).service_price).toBe(0);
  });

  it("preserves separate UUID-backed revenue charges", () => {
    const payload = bookingToCloudPayload(booking({ additionalCharges: [{
      id: "charge-1", bookingId: "booking-1", sessionId: null,
      categoryId: "8d90cf82-8166-4557-95b3-0ebbc431cf46", categoryName: "Extra assistant",
      description: "Second artist", amount: 25_000, createdAt: 1, updatedAt: 1,
    }] }));
    expect(payload.additional_charges).toEqual([expect.objectContaining({
      category_id: "8d90cf82-8166-4557-95b3-0ebbc431cf46",
      category_name: "Extra assistant", amount: 25_000,
    })]);
  });

  it("rejects invalid negative or non-finite prices instead of masking them", () => {
    expect(() => bookingToCloudPayload(booking({ servicePrice: -1 }))).toThrow("BOOKING_SERVICE_PRICE_INVALID");
    expect(() => bookingToCloudPayload(booking({ servicePrice: Number.NaN }))).toThrow("BOOKING_SERVICE_PRICE_INVALID");
  });

  it("writes a priced Booking and charge through the integrity RPC atomically", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "booking-1", error: null });
    vi.mocked(createClient).mockReturnValue({ rpc } as never);
    const charged = booking({ additionalCharges: [{
      id: "charge-1", bookingId: "booking-1", sessionId: null,
      categoryId: "8d90cf82-8166-4557-95b3-0ebbc431cf46", categoryName: "Extra assistant",
      description: "", amount: 25_000, createdAt: 1, updatedAt: 1,
    }] });

    await cloudBookingRepository.create(charged);

    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("save_booking_with_integrity", {
      booking_payload: expect.objectContaining({ service_price: 50_000, additional_charges: [expect.objectContaining({ amount: 25_000 })] }),
    });
  });

  it("preserves safe RPC diagnostics instead of collapsing a cloud save failure", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "22P02",
        message: 'invalid input syntax for type uuid: "charge-category-7"',
        details: "private database detail",
        hint: null,
      },
      status: 400,
    });
    vi.mocked(createClient).mockReturnValue({ rpc } as never);

    await expect(cloudBookingRepository.create(booking())).rejects.toMatchObject({
      name: "BookingSaveError",
      message: "The Additional Charge category could not be saved.",
      operation: "save_booking_with_integrity",
      code: "22P02",
      status: 400,
    });
    expect(consoleError).toHaveBeenCalledWith("Booking cloud save failed.", {
      operation: "save_booking_with_integrity",
      status: 400,
      code: "22P02",
      reason: "The Additional Charge category could not be saved.",
    });
  });

  it("uses the legacy RPC during a safe migration rollout only for UUID-backed categories", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "save_booking_with_integrity was not found in the schema cache" } })
      .mockResolvedValueOnce({ data: "booking-1", error: null });
    vi.mocked(createClient).mockReturnValue({ rpc } as never);
    const uuidCharge = { id: "charge-1", bookingId: "booking-1", sessionId: null, categoryId: "8d90cf82-8166-4557-95b3-0ebbc431cf46", categoryName: "Extra assistant", description: "", amount: 25_000, createdAt: 1, updatedAt: 1 };
    await cloudBookingRepository.create(booking({ additionalCharges: [uuidCharge] }));
    expect(rpc.mock.calls.map(([name]) => name)).toEqual(["save_booking_with_integrity", "save_booking_with_questionnaire"]);

    rpc.mockReset().mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "not found" } });
    await expect(cloudBookingRepository.create(booking({ additionalCharges: [{ ...uuidCharge, categoryId: "charge-category-7" }] }))).rejects.toMatchObject({
      name: "BookingSaveError",
      message: "The Additional Charge category could not be saved.",
      code: "BOOKING_INTEGRITY_MIGRATION_REQUIRED",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
