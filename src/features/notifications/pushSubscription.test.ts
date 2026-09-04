import { describe, expect, it } from "vitest";

import { pushSubscriptionSchema, urlBase64ToUint8Array } from "./pushSubscription";
import { safePushPath } from "./pushSafety";
import { bookingPaymentHref } from "@/features/booking/domain/bookingDeepLinks";

describe("Web Push subscriptions", () => {
  it("validates the endpoint and both browser encryption keys", () => {
    expect(pushSubscriptionSchema.parse({ endpoint: "https://push.example/subscription", expirationTime: null, keys: { p256dh: "public-key", auth: "auth-secret" } })).toMatchObject({ keys: { p256dh: "public-key", auth: "auth-secret" } });
    expect(() => pushSubscriptionSchema.parse({ endpoint: "https://push.example/subscription", keys: { p256dh: "", auth: "" } })).toThrow();
    expect(() => pushSubscriptionSchema.parse({ endpoint: "http://push.example/subscription", keys: { p256dh: "public-key", auth: "auth-secret" } })).toThrow();
  });

  it("converts a VAPID URL-safe public key to subscription bytes", () => {
    expect([...urlBase64ToUint8Array("AQIDBA")]).toEqual([1, 2, 3, 4]);
  });

  it("restricts notification navigation to Qai-relative paths", () => {
    expect(safePushPath("/bookings?booking=123#schedule")).toBe("/bookings?booking=123#schedule");
    expect(safePushPath("/bookings?payment=overdue&booking=123")).toBe("/bookings?payment=overdue&booking=123");
    expect(safePushPath("https://evil.example/phish")).toBe("/dashboard");
    expect(safePushPath("//evil.example/phish")).toBe("/dashboard");
    expect(safePushPath("/\\evil.example/phish")).toBe("/dashboard");
  });

  it("preserves Overdue and Unpaid Booking context in notification deep links", () => {
    expect(safePushPath(bookingPaymentHref("Overdue", "booking-1"))).toBe(
      "/bookings?payment=overdue&booking=booking-1",
    );
    expect(safePushPath(bookingPaymentHref("Outstanding", "booking-2"))).toBe(
      "/bookings?payment=outstanding&booking=booking-2",
    );
  });
});
