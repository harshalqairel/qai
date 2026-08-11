export type PaymentReminderDetails = {
  customerName: string;
  businessName: string;
  serviceName: string;
  remainingAmount: string;
  dueDate: string;
};

export function isPaymentReminderEligible(booking: { bookingStatus: string; remainingAmount: number }): boolean {
  return booking.bookingStatus !== "Cancelled" && booking.remainingAmount > 0;
}

export function normalizePhoneForWhatsApp(phone: string, defaultCountryCode = "62"): string | null {
  let digits = phone.trim().replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `${defaultCountryCode}${digits.slice(1)}`;
  else if (digits.startsWith("8") && defaultCountryCode === "62") digits = `62${digits}`;
  return digits.length >= 8 ? digits : null;
}

export function buildPaymentReminderMessage(details: PaymentReminderDetails): string {
  return [
    `Hi ${details.customerName},`,
    "",
    `Just a friendly reminder from ${details.businessName} regarding your ${details.serviceName} booking.`,
    "",
    `Remaining payment: ${details.remainingAmount}`,
    `Due date: ${details.dueDate}`,
    "",
    "Thank you.",
  ].join("\n");
}

export function buildWhatsAppReminderUrl(phone: string, details: PaymentReminderDetails): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(buildPaymentReminderMessage(details))}` : null;
}

export function buildEmailReminderUrl(email: string, details: PaymentReminderDetails): string | null {
  const recipient = email.trim();
  if (!recipient) return null;
  const subject = `Payment Reminder — ${details.businessName}`;
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildPaymentReminderMessage(details))}`;
}
