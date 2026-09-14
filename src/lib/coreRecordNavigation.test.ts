import { describe, expect, it } from "vitest";
import { bookingHref, requestsHref } from "./coreRecordNavigation";

describe("core record navigation", () => {
  it("preserves the stable Booking identity for open and payment actions", () => {
    expect(bookingHref("booking-1")).toBe("/bookings?booking=booking-1");
    expect(bookingHref("booking-1", "payment")).toBe("/bookings?booking=booking-1&action=payment");
  });

  it("focuses the original Qai Space request identity", () => {
    expect(requestsHref("request-1")).toBe("/space?tab=Requests&request=request-1");
  });
});
