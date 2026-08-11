import { describe, expect, it } from "vitest";
import { DEFAULT_REMINDER_TEMPLATES } from "./reminderTemplates";
import { buildEmailReminderUrl, buildWhatsAppReminderUrl, isPaymentReminderEligible, normalizePhoneForWhatsApp } from "./reminderTransport";

const details = { customerName: "Sarah", businessName: "Qai Studio", serviceName: "Wedding Makeup", bookingDate: "12 Aug 2026", bookingValue: "Rp 7.500.000", totalPaid: "Rp 6.000.000", remainingAmount: "Rp 1.500.000", dueDate: "15 Aug 2026", nextSessionDate: "20 Aug 2026" };

describe("payment reminder transport", () => {
  it("normalizes Indonesian phone numbers only for WhatsApp transport", () => {
    expect(normalizePhoneForWhatsApp("0812 3456 789")).toBe("628123456789");
    expect(normalizePhoneForWhatsApp("+62 812-3456-789")).toBe("628123456789");
  });
  it("builds encoded wa.me and mailto reminders from semantic templates", () => {
    const whatsapp = buildWhatsAppReminderUrl("08123456789", DEFAULT_REMINDER_TEMPLATES.dueSoon.whatsapp, details);
    expect(whatsapp).toContain("https://wa.me/628123456789?text=");
    expect(decodeURIComponent(whatsapp ?? "")).toContain("friendly reminder from Qai Studio");
    const email = buildEmailReminderUrl("sarah@example.com", DEFAULT_REMINDER_TEMPLATES.dueSoon.emailSubject, DEFAULT_REMINDER_TEMPLATES.dueSoon.emailBody, details);
    expect(email).toContain("mailto:sarah%40example.com");
    expect(decodeURIComponent(email ?? "")).toContain("Payment Reminder — Qai Studio");
  });
  it("returns null when contact details are missing", () => {
    expect(buildWhatsAppReminderUrl("", DEFAULT_REMINDER_TEMPLATES.dueSoon.whatsapp, details)).toBeNull();
    expect(buildEmailReminderUrl("", DEFAULT_REMINDER_TEMPLATES.dueSoon.emailSubject, DEFAULT_REMINDER_TEMPLATES.dueSoon.emailBody, details)).toBeNull();
  });
  it("excludes cancelled, paid, and zero-outstanding bookings", () => {
    expect(isPaymentReminderEligible({ bookingStatus: "Scheduled", remainingAmount: 1 })).toBe(true);
    expect(isPaymentReminderEligible({ bookingStatus: "Cancelled", remainingAmount: 1 })).toBe(false);
    expect(isPaymentReminderEligible({ bookingStatus: "Completed", remainingAmount: 0 })).toBe(false);
  });
});
