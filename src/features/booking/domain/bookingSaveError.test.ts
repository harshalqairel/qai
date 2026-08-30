import { describe, expect, it } from "vitest";

import {
  BookingSaveError,
  bookingSaveErrorMessage,
  createCloudBookingSaveError,
} from "./bookingSaveError";

describe("Booking save errors", () => {
  it("keeps safe RPC diagnostics while hiding raw database details from the UI", () => {
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

  it("gives useful messages for authentication, relationships, and unavailable RPCs", () => {
    expect(bookingSaveErrorMessage(createCloudBookingSaveError(
      { code: "42501", message: "permission denied" },
      "save_booking_with_integrity",
      401,
    ))).toContain("Sign in again");
    expect(bookingSaveErrorMessage(createCloudBookingSaveError(
      { code: "23503", message: "foreign key violation" },
      "save_booking_with_integrity",
      409,
    ))).toContain("Client or Service");
    expect(bookingSaveErrorMessage(createCloudBookingSaveError(
      { code: "PGRST202", message: "function missing from schema cache" },
      "save_booking_with_integrity",
      404,
    ))).toContain("cloud booking service");
  });

  it("does not expose an unknown raw Supabase message", () => {
    const message = bookingSaveErrorMessage(new Error("sensitive internal relation name"));
    expect(message).toBe("Could not save the booking: The cloud save failed. Try again.");
  });
});
