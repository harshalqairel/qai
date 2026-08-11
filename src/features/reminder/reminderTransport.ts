import { renderReminderTemplate } from "./reminderTemplates";
import type { ReminderContext } from "./types";

export type PaymentReminderDetails = ReminderContext;

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

export function buildPaymentReminderMessage(template: string, details: PaymentReminderDetails): string {
  return renderReminderTemplate(template, details).value;
}

export function buildWhatsAppReminderUrl(phone: string, template: string, details: PaymentReminderDetails): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  const rendered = renderReminderTemplate(template, details);
  return normalized && rendered.errors.length === 0
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(rendered.value)}`
    : null;
}

export function buildEmailReminderUrl(email: string, subjectTemplate: string, bodyTemplate: string, details: PaymentReminderDetails): string | null {
  const recipient = email.trim();
  const subject = renderReminderTemplate(subjectTemplate, details);
  const body = renderReminderTemplate(bodyTemplate, details);
  if (!recipient || subject.errors.length > 0 || body.errors.length > 0) return null;
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject.value)}&body=${encodeURIComponent(body.value)}`;
}
