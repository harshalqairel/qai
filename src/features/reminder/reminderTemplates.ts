import type { ReminderContext, ReminderScenarioTemplate, ReminderTemplateSet, ReminderType } from "./types";

export const LOCAL_BUSINESS_ID = "local-business";
export const MAX_REMINDER_MESSAGE_LENGTH = 4000;
export const MAX_REMINDER_SUBJECT_LENGTH = 200;

export const REMINDER_VARIABLES = [
  { token: "{customer_name}", label: "Client name", key: "customerName" },
  { token: "{business_name}", label: "Business name", key: "businessName" },
  { token: "{service_name}", label: "Service", key: "serviceName" },
  { token: "{booking_date}", label: "Booking date", key: "bookingDate" },
  { token: "{due_date}", label: "Due date", key: "dueDate" },
  { token: "{booking_value}", label: "Booking price", key: "bookingValue" },
  { token: "{total_paid}", label: "Amount paid", key: "totalPaid" },
  { token: "{remaining_amount}", label: "Amount remaining", key: "remainingAmount" },
  { token: "{next_session_date}", label: "Next schedule", key: "nextSessionDate" },
] as const;

export const DEFAULT_REMINDER_TEMPLATES: ReminderTemplateSet = {
  dueSoon: {
    whatsapp: "Hi {customer_name},\n\nJust a friendly reminder from {business_name} regarding your {service_name} booking.\n\nRemaining payment: {remaining_amount}\nDue date: {due_date}\n\nThank you.",
    emailSubject: "Payment Reminder — {business_name}",
    emailBody: "Hi {customer_name},\n\nJust a friendly reminder from {business_name} regarding your {service_name} booking.\n\nBooking value: {booking_value}\nTotal paid: {total_paid}\nRemaining payment: {remaining_amount}\nDue date: {due_date}\n\nThank you.",
  },
  overdue: {
    whatsapp: "Hi {customer_name},\n\nThis is a reminder from {business_name} regarding your {service_name} booking.\n\nThe remaining payment of {remaining_amount} was due on {due_date}.\n\nThank you.",
    emailSubject: "Payment Reminder — {business_name}",
    emailBody: "Hi {customer_name},\n\nThis is a reminder from {business_name} regarding your {service_name} booking.\n\nThe remaining payment of {remaining_amount} was due on {due_date}.\n\nThank you.",
  },
};

const TOKEN_PATTERN = /\{[^{}\n]+\}/g;
const KNOWN_TOKENS = new Set(REMINDER_VARIABLES.map((variable) => variable.token));

export function scenarioTemplate(templates: ReminderTemplateSet, type: ReminderType): ReminderScenarioTemplate {
  return type === "overdue" ? templates.overdue : templates.dueSoon;
}

export function unknownReminderVariables(template: string): string[] {
  return [...new Set(template.match(TOKEN_PATTERN) ?? [])].filter((token) => !KNOWN_TOKENS.has(token as never));
}

export function validateReminderTemplate(template: string, maximumLength = MAX_REMINDER_MESSAGE_LENGTH): string[] {
  const errors = unknownReminderVariables(template).map((token) => `Unknown variable: ${token}`);
  if (template.length > maximumLength) errors.push(`Keep this template under ${maximumLength.toLocaleString()} characters.`);
  if (!template.trim()) errors.push("Template cannot be empty.");
  return errors;
}

export function renderReminderTemplate(template: string, context: ReminderContext): { value: string; errors: string[] } {
  const errors = validateReminderTemplate(template);
  if (errors.length > 0) return { value: "", errors };
  const values: Record<string, string> = Object.fromEntries(REMINDER_VARIABLES.map((variable) => [
    variable.token,
    String(context[variable.key] ?? "").trim(),
  ]));
  const value = template
    .replace(TOKEN_PATTERN, (token) => values[token] ?? "")
    .split("\n")
    .filter((line) => !/^\s*[^:]+:\s*$/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { value, errors: [] };
}

export function validateReminderTemplateSet(templates: ReminderTemplateSet): string[] {
  return [templates.dueSoon, templates.overdue].flatMap((scenario) => [
    ...validateReminderTemplate(scenario.whatsapp),
    ...validateReminderTemplate(scenario.emailSubject, MAX_REMINDER_SUBJECT_LENGTH),
    ...validateReminderTemplate(scenario.emailBody),
  ]);
}

export const SAMPLE_REMINDER_CONTEXT: ReminderContext = {
  customerName: "Sarah",
  businessName: "Qai Studio",
  serviceName: "Wedding Makeup",
  bookingDate: "12 Aug 2026",
  dueDate: "15 Aug 2026",
  bookingValue: "Rp 7.500.000",
  totalPaid: "Rp 6.000.000",
  remainingAmount: "Rp 1.500.000",
  nextSessionDate: "20 Aug 2026",
};
