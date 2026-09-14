import { normalizePhoneForWhatsApp } from "@/features/reminder/reminderTransport";

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function buildWhatsAppMessageUrl(phone: string, body: string): string | null {
  const recipient = normalizePhoneForWhatsApp(phone);
  const message = body.trim();
  return recipient && message ? `https://wa.me/${recipient}?text=${encodeURIComponent(message)}` : null;
}

export function buildEmailDraftUrl(email: string, subject: string, body: string): string | null {
  const recipient = email.trim();
  const message = body.trim();
  if (!SIMPLE_EMAIL_PATTERN.test(recipient) || !message) return null;
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(message)}`;
}
