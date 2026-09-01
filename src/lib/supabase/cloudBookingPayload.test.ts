import { afterEach, describe, expect, it, vi } from "vitest";

import type { Booking } from "@/features/booking/types";
import type { Payment } from "@/features/payment/types";
import { createClient } from "./client";
import { bookingToCloudPayload, cloudBookingRepository } from "./cloudRepositories";

vi.mock("./client", () => ({ createClient: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

function booking(changes: Partial<Booking> = {}): Booking {
  return {
    id: "f979e218-11e8-4c06-8df9-6fdbdd0b6ed7",
    customerId: "8e71719a-94c7-4ff9-9e45-a1e5ea8ec0fd",
    serviceId: "3c7152e5-870b-4927-9860-c81cfa61fc69",
    servicePrice: 50_000,
    serviceSnapshot: null,
    sessions: [{
      id: "fe9cf5f3-051d-469e-8067-5c35d574ebac",
      bookingId: "f979e218-11e8-4c06-8df9-6fdbdd0b6ed7",
      sequence: 1,
      label: "",
      startAt: "2026-08-31T03:00:00.000Z",
      endAt: "2026-08-31T04:00:00.000Z",
      location: "Online",
      notes: "",
      createdAt: 1,
      updatedAt: 1,
    }],
    additionalCharges: [],
    questionnaireResponses: [],
    capacitySourceRequestId: null,
    capacitySlotKeys: [],
    bookingStatus: "Scheduled",
    fullPaymentDueDate: "2026-08-31",
    notes: "",
    createdAt: 1,
    updatedAt: 1,
    ...changes,
  };
}

function initialPayment(): Payment {
  return {
    id: "9b56fc9a-18be-4565-a5cc-6d57d1933d79",
    bookingId: "f979e218-11e8-4c06-8df9-6fdbdd0b6ed7",
    date: "2026-08-31",
    amount: 25_000,
    method: "Bank Transfer",
    notes: "Deposit",
    createdAt: 1,
  };
}

describe("cloud Booking financial payload", () => {
  it("persists a captured Booking price and a legitimate zero exactly", () => {
    expect(bookingToCloudPayload(booking()).service_price).toBe(50_000);
    expect(bookingToCloudPayload(booking({ servicePrice: 0 })).service_price).toBe(0);
  });

  it("uses the atomic writer for a normal Booking without charges or payment", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: booking().id, error: null, status: 200 });
    vi.mocked(createClient).mockReturnValue({ rpc } as never);
    await cloudBookingRepository.create(booking());
    expect(rpc).toHaveBeenCalledWith("save_booking_with_initial_payment", {
      booking_payload: expect.objectContaining({ service_price: 50_000, additional_charges: [] }),
      initial_payment_payload: null,
    });
  });

  it("sends one and multiple Additional Charges as revenue-side records", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: booking().id, error: null, status: 200 });
    vi.mocked(createClient).mockReturnValue({ rpc } as never);
    const charges = [
      { id: "a2cd7595-a8ad-4fb4-a7bf-afec5a1f87e9", bookingId: booking().id, sessionId: null, categoryId: "8d90cf82-8166-4557-95b3-0ebbc431cf46", categoryName: "Extra assistant", description: "Second artist", amount: 25_000, createdAt: 1, updatedAt: 1 },
      { id: "bab7bde9-caff-46ce-9897-5987cc1b8b81", bookingId: booking().id, sessionId: null, categoryId: "8d90cf82-8166-4557-95b3-0ebbc431cf46", categoryName: "Extra assistant", description: "Third artist", amount: 10_000, createdAt: 1, updatedAt: 1 },
    ];
    await cloudBookingRepository.create(booking({ additionalCharges: charges }));
    expect(rpc).toHaveBeenCalledWith("save_booking_with_initial_payment", {
      booking_payload: expect.objectContaining({ additional_charges: [expect.objectContaining({ amount: 25_000 }), expect.objectContaining({ amount: 10_000 })] }),
      initial_payment_payload: null,
    });
  });

  it("persists the initial Payment inside the same Booking RPC call", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: booking().id, error: null, status: 200 });
    vi.mocked(createClient).mockReturnValue({ rpc } as never);
    await cloudBookingRepository.create(booking(), initialPayment());
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("save_booking_with_initial_payment", {
      booking_payload: expect.objectContaining({ service_price: 50_000 }),
      initial_payment_payload: expect.objectContaining({
        booking_id: booking().id,
        amount: 25_000,
        payment_date: "2026-08-31",
      }),
    });
  });

  it("never falls back to a non-atomic path when an initial Payment is present", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "save_booking_with_initial_payment was not found in the schema cache" },
      status: 404,
    });
    vi.mocked(createClient).mockReturnValue({ rpc } as never);
    await expect(cloudBookingRepository.create(booking(), initialPayment())).rejects.toMatchObject({
      name: "BookingSaveError",
      operation: "save_booking_with_initial_payment",
      code: "BOOKING_PAYMENT_MIGRATION_REQUIRED",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("rejects invalid prices instead of masking them with a live Service price", () => {
    expect(() => bookingToCloudPayload(booking({ servicePrice: -1 }))).toThrow("BOOKING_SERVICE_PRICE_INVALID");
    expect(() => bookingToCloudPayload(booking({ servicePrice: Number.NaN }))).toThrow("BOOKING_SERVICE_PRICE_INVALID");
  });
});
