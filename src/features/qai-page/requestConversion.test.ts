import { describe, expect, it, vi } from "vitest";
import type { Booking } from "@/features/booking/types";
import { convertRequestToBooking, requestConversionCapabilityMessage, RequestConversionError } from "./requestConversion";

const booking = { id: "booking-1" } as Booking;

function dependencies(overrides: Partial<Parameters<typeof convertRequestToBooking>[0]> = {}) {
  return {
    requestId: "request-exact-1",
    clientId: "client-1",
    claimRequest: vi.fn().mockResolvedValue(undefined),
    createBooking: vi.fn().mockResolvedValue(booking),
    linkRequest: vi.fn().mockResolvedValue(undefined),
    releaseClaim: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Qai Page request conversion", () => {
  it("keeps flexible Services independent from managed availability infrastructure", () => {
    expect(requestConversionCapabilityMessage({
      managedAvailability: false,
      capabilities: { supportsManagedAvailability: false, supportsRequestBookingIdempotency: false, status: "migration-required" },
      includeValidationDetail: true,
    })).toBeNull();
  });

  it("blocks managed conversion before the dialog when the workspace migration is missing", () => {
    expect(requestConversionCapabilityMessage({
      managedAvailability: true,
      capabilities: { supportsManagedAvailability: false, supportsRequestBookingIdempotency: false, status: "migration-required" },
      includeValidationDetail: true,
    })).toContain("Required database migration: 202608250001");
  });

  it("does not mislabel a capability-check failure as a missing migration", () => {
    expect(requestConversionCapabilityMessage({
      managedAvailability: true,
      capabilities: { supportsManagedAvailability: false, supportsRequestBookingIdempotency: false, status: "check-failed" },
      includeValidationDetail: true,
    })).toBe("Qai could not verify booking availability for this workspace. Refresh and try again.");
  });

  it("uses the exact request id for claim, idempotent Booking creation, and final link", async () => {
    const deps = dependencies();
    await expect(convertRequestToBooking(deps)).resolves.toBe(booking);
    expect(deps.claimRequest).toHaveBeenCalledWith("request-exact-1");
    expect(deps.createBooking).toHaveBeenCalledWith("qai-page:request-exact-1");
    expect(deps.linkRequest).toHaveBeenCalledWith("request-exact-1", "booking-1", "client-1");
    expect(deps.releaseClaim).not.toHaveBeenCalled();
  });

  it("releases the claim and leaves the request retryable when Booking persistence fails", async () => {
    const deps = dependencies({ createBooking: vi.fn().mockRejectedValue(new Error("remote confirmation failed")) });
    await expect(convertRequestToBooking(deps)).rejects.toMatchObject({ code: "BOOKING_SAVE_FAILED" });
    expect(deps.releaseClaim).toHaveBeenCalledWith("request-exact-1", "client-1");
    expect(deps.linkRequest).not.toHaveBeenCalled();
  });

  it("retries an already-created Booking through the same idempotency key and links it once", async () => {
    const createBooking = vi.fn().mockResolvedValue(booking);
    const first = dependencies({ createBooking, linkRequest: vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValue(undefined) });
    await expect(convertRequestToBooking(first)).rejects.toBeInstanceOf(RequestConversionError);
    await expect(convertRequestToBooking(first)).resolves.toBe(booking);
    expect(createBooking).toHaveBeenNthCalledWith(1, "qai-page:request-exact-1");
    expect(createBooking).toHaveBeenNthCalledWith(2, "qai-page:request-exact-1");
    expect(first.releaseClaim).not.toHaveBeenCalled();
  });

  it("does not create a Booking when capacity claiming fails", async () => {
    const deps = dependencies({ claimRequest: vi.fn().mockRejectedValue(new Error("That time is full.")) });
    await expect(convertRequestToBooking(deps)).rejects.toMatchObject({ code: "CLAIM_FAILED", message: "That time is full." });
    expect(deps.createBooking).not.toHaveBeenCalled();
    expect(deps.linkRequest).not.toHaveBeenCalled();
  });
});
