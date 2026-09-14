import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import type { CommunicationChannel, CommunicationContext, CommunicationTemplateType } from "./types";

export const COMMUNICATION_TEMPLATE_OPTIONS: ReadonlyArray<{ value: CommunicationTemplateType; label: string }> = [
  { value: "blank", label: "Blank" },
  { value: "booking_confirmation", label: "Booking confirmation" },
  { value: "appointment_reminder", label: "Appointment reminder" },
  { value: "payment_reminder", label: "Payment reminder" },
  { value: "overdue_reminder", label: "Overdue reminder" },
  { value: "payment_received", label: "Payment received" },
  { value: "thank_you_follow_up", label: "Thank you / follow-up" },
];

export type RenderedCommunicationTemplate = { subject: string; body: string };

function greeting(context: CommunicationContext) {
  return `Hi ${context.customerName},`;
}

function signoff(context: CommunicationContext) {
  return `Thank you,\n${context.businessName}`;
}

export function renderCommunicationTemplate(
  templateType: CommunicationTemplateType,
  channel: CommunicationChannel,
  context: CommunicationContext,
): RenderedCommunicationTemplate {
  const bookingWhen = context.nextSessionDate || context.bookingDate || "your scheduled time";
  const remaining = formatRupiah(context.remainingAmount);
  const paid = formatRupiah(context.totalPaid);
  const subjectByTemplate: Record<CommunicationTemplateType, string> = {
    blank: "",
    booking_confirmation: `Your ${context.serviceName} booking`,
    appointment_reminder: `Reminder: ${context.serviceName}`,
    payment_reminder: `Payment reminder from ${context.businessName}`,
    overdue_reminder: `Overdue payment reminder from ${context.businessName}`,
    payment_received: `Payment received by ${context.businessName}`,
    thank_you_follow_up: `Thank you from ${context.businessName}`,
  };
  const bodyByTemplate: Record<CommunicationTemplateType, string> = {
    blank: "",
    booking_confirmation: `${greeting(context)}\n\nYour ${context.serviceName} booking is scheduled for ${bookingWhen}. Please let us know if anything changes.\n\n${signoff(context)}`,
    appointment_reminder: `${greeting(context)}\n\nA friendly reminder about your ${context.serviceName} booking on ${bookingWhen}.\n\n${signoff(context)}`,
    payment_reminder: `${greeting(context)}\n\nA friendly reminder that ${remaining} remains for your ${context.serviceName} booking${context.dueDate ? `, due ${context.dueDate}` : ""}.\n\n${signoff(context)}`,
    overdue_reminder: `${greeting(context)}\n\nThe remaining payment of ${remaining} for your ${context.serviceName} booking was due ${context.dueDate || "earlier"}. Please let us know if you need the payment details again.\n\n${signoff(context)}`,
    payment_received: `${greeting(context)}\n\nWe have recorded your payment. Total paid: ${paid}${context.remainingAmount > 0 ? `. Remaining: ${remaining}` : ". Your booking is fully paid."}\n\n${signoff(context)}`,
    thank_you_follow_up: `${greeting(context)}\n\nThank you for choosing ${context.businessName} for ${context.serviceName}. We hope everything went beautifully.\n\n${signoff(context)}`,
  };
  return {
    subject: channel === "email" ? subjectByTemplate[templateType] : "",
    body: bodyByTemplate[templateType],
  };
}

export function friendlyCommunicationInserts(context: CommunicationContext) {
  return [
    { label: "Client name", value: context.customerName },
    { label: "Booking date", value: context.nextSessionDate || context.bookingDate },
    { label: "Remaining payment", value: formatRupiah(context.remainingAmount) },
    { label: "Payment details", value: `Paid ${formatRupiah(context.totalPaid)} · Remaining ${formatRupiah(context.remainingAmount)}` },
  ].filter((item) => item.value.trim().length > 0);
}
