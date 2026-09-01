import { describe, expect, it } from "vitest";

import {
  PaymentSaveError,
  createCloudPaymentSaveError,
  paymentSaveErrorMessage,
} from "./paymentSaveError";

describe("Payment save errors", () => {
  it("preserves developer diagnostics and gives the owner a safe outstanding-balance message", () => {
    const error = createCloudPaymentSaveError({
      code: "P0001",
      message: "Payment exceeds the booking outstanding amount",
      details: "private trigger context",
    }, "create_payment", 400);
    expect(error).toBeInstanceOf(PaymentSaveError);
    expect(error).toMatchObject({ code: "P0001", operation: "create_payment", status: 400 });
    expect(paymentSaveErrorMessage(error)).toBe(
      "Could not save the payment: The amount exceeds this booking's outstanding balance.",
    );
    expect(paymentSaveErrorMessage(error)).not.toContain("trigger");
  });
});
