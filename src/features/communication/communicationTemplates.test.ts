import { describe, expect, it } from "vitest";
import { COMMUNICATION_TEMPLATE_OPTIONS, friendlyCommunicationInserts, renderCommunicationTemplate } from "./communicationTemplates";
import type { CommunicationContext } from "./types";

const context: CommunicationContext = {
  customerId: "customer-1", bookingId: "booking-1", customerName: "Ayu", customerPhone: "081234567890",
  customerEmail: "ayu@example.com", businessName: "Qai Studio", serviceName: "Portrait", bookingDate: "20 Sep 2026",
  dueDate: "18 Sep 2026", bookingValue: 1_500_000, totalPaid: 500_000, remainingAmount: 1_000_000,
};

describe("communication templates", () => {
  it("offers every launch template", () => {
    expect(COMMUNICATION_TEMPLATE_OPTIONS.map((item) => item.value)).toEqual([
      "blank", "booking_confirmation", "appointment_reminder", "payment_reminder", "overdue_reminder", "payment_received", "thank_you_follow_up",
    ]);
  });

  it("renders friendly values without exposing raw placeholder syntax", () => {
    const overdue = renderCommunicationTemplate("overdue_reminder", "email", context);
    expect(overdue.subject).toContain("Overdue payment reminder");
    expect(overdue.body).toContain("Ayu");
    expect(overdue.body).toContain("Rp 1.000.000");
    expect(overdue.body).not.toMatch(/\{[^}]+\}/);
  });

  it("provides resolved, friendly insert values", () => {
    expect(friendlyCommunicationInserts(context)).toEqual(expect.arrayContaining([
      { label: "Client name", value: "Ayu" },
      { label: "Remaining payment", value: "Rp 1.000.000" },
    ]));
  });
});
