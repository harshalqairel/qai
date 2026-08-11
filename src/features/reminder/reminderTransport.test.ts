import { describe, expect, it } from "vitest";
import { buildEmailReminderUrl, buildWhatsAppReminderUrl, isPaymentReminderEligible, normalizePhoneForWhatsApp } from "./reminderTransport";

const details = { customerName: "Sarah", businessName: "Qai Studio", serviceName: "Wedding Makeup", remainingAmount: "Rp 1.500.000", dueDate: "15 Aug 2026" };

describe("payment reminder transport", () => {
  it("normalizes Indonesian phone numbers only for WhatsApp transport", () => {
    expect(normalizePhoneForWhatsApp("0812 3456 789")).toBe("628123456789");
    expect(normalizePhoneForWhatsApp("+62 812-3456-789")).toBe("628123456789");
  });

  it("builds reusable wa.me and mailto reminders from business data", () => {
    const whatsapp = buildWhatsAppReminderUrl("08123456789", details);
    expect(whatsapp).toContain("https://wa.me/628123456789?text=");
    expect(decodeURIComponent(whatsapp ?? "")).toContain("friendly reminder from Qai Studio");
    const email = buildEmailReminderUrl("sarah@example.com", details);
    expect(email).toContain("mailto:sarah%40example.com");
    expect(decodeURIComponent(email ?? "")).toContain("Payment Reminder — Qai Studio");
  });

  it("returns null when contact details are missing", () => {
    expect(buildWhatsAppReminderUrl("", details)).toBeNull();
    expect(buildEmailReminderUrl("", details)).toBeNull();
  });

  it("excludes cancelled, paid, and zero-outstanding bookings", () => {
    expect(isPaymentReminderEligible({ bookingStatus: "Scheduled", remainingAmount: 1 })).toBe(true);
    expect(isPaymentReminderEligible({ bookingStatus: "Cancelled", remainingAmount: 1 })).toBe(false);
    expect(isPaymentReminderEligible({ bookingStatus: "Completed", remainingAmount: 0 })).toBe(false);
  });
});
