import type { Booking } from "@/features/booking/types";

export type RequestConversionDependencies = {
  requestId: string;
  clientId: string;
  claimRequest: (requestId: string) => Promise<unknown>;
  createBooking: (requestId: string) => Promise<Booking>;
  linkRequest: (requestId: string, bookingId: string, clientId: string) => Promise<unknown>;
  releaseClaim: (requestId: string, clientId: string) => Promise<unknown>;
};

export class RequestConversionError extends Error {
  readonly code: "CLAIM_FAILED" | "BOOKING_SAVE_FAILED" | "REQUEST_LINK_FAILED";
  readonly booking: Booking | null;

  constructor(code: RequestConversionError["code"], message: string, booking: Booking | null = null) {
    super(message);
    this.name = "RequestConversionError";
    this.code = code;
    this.booking = booking;
  }
}

/**
 * The request id is the single idempotency key across capacity claim, Booking
 * persistence, and the final request link. Capacity is claimed first; a failed
 * Booking write releases that claim so a normal retry starts Pending again.
 */
export async function convertRequestToBooking(input: RequestConversionDependencies): Promise<Booking> {
  try {
    await input.claimRequest(input.requestId);
  } catch (error) {
    throw new RequestConversionError("CLAIM_FAILED", error instanceof Error ? error.message : "That booking could not be accepted.");
  }

  let booking: Booking;
  try {
    booking = await input.createBooking(`qai-page:${input.requestId}`);
  } catch (error) {
    await input.releaseClaim(input.requestId, input.clientId).catch(() => undefined);
    throw new RequestConversionError("BOOKING_SAVE_FAILED", error instanceof Error ? error.message : "Could not save the booking.");
  }

  try {
    await input.linkRequest(input.requestId, booking.id, input.clientId);
  } catch (error) {
    throw new RequestConversionError("REQUEST_LINK_FAILED", error instanceof Error ? error.message : "The booking was saved, but the request link still needs to be completed.", booking);
  }
  return booking;
}
