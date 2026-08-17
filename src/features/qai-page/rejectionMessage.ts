import { normalizePhoneForWhatsApp } from "@/features/reminder/reminderTransport";

export type RejectionMessageContext = {
  clientName: string;
  serviceName: string;
  businessName: string;
};

const TOKENS: Record<string, keyof RejectionMessageContext> = {
  client_name: "clientName",
  service_name: "serviceName",
  business_name: "businessName",
};

export function renderRejectionMessage(template: string, context: RejectionMessageContext): string {
  return template.replace(/\{([a-z_]+)\}/gi, (source, token: string) => {
    const field = TOKENS[token.toLowerCase()];
    return field ? context[field] : source;
  }).trim();
}

export function rejectionWhatsAppUrl(phone: string, message: string, defaultCountryCode = "62"): string | null {
  const normalized = normalizePhoneForWhatsApp(phone, defaultCountryCode);
  const content = message.trim();
  return normalized && content ? `https://wa.me/${normalized}?text=${encodeURIComponent(content)}` : null;
}
