import { describe, expect, it } from "vitest";

import {
  BookingSaveError,
  bookingSaveErrorMessage,
  createCloudBookingSaveError,
} from "./bookingSaveError";

describe("Booking save errors", () => {
  it("keeps safe diagnostics while hiding raw database details from the UI", () => {
    const error = createCloudBookingSaveError({
      code: "22P02",
      message: 'invalid input syntax for type uuid: "charge-category-7"',
      details: "private database detail",
    }, "save_booking_with_integrity", 400);

    expect(error).toBeInstanceOf(BookingSaveError);
    expect(error).toMatchObject({
      code: "22P02",
      operation: "save_booking_with_integrity",
      status: 400,
    });
    expect(bookingSaveErrorMessage(error)).toBe(
      "Could not save the booking: The Additional Charge category could not be saved.",
    );
    expect(bookingSaveErrorMessage(error)).not.toContain("charge-category-7");
    expect(bookingSaveErrorMessage(error)).not.toContain("private database detail");
  });

  it("explains an initial payment failure without exposing SQL", () => {
    const error = createCloudBookingSaveError(
      { code: "P0001", message: "Payment exceeds the booking outstanding amount" },
      "save_booking_with_initial_payment",
      400,
    );
    expect(bookingSaveErrorMessage(error)).toBe(
      "Could not save the booking: The initial payment exceeds the booking outstanding amount.",
    );
  });
});
