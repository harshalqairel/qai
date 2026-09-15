import { z } from "zod";

export const COMMUNICATION_CHANNELS = ["whatsapp", "email"] as const;
export const COMMUNICATION_TEMPLATE_TYPES = [
  "blank",
  "booking_confirmation",
  "appointment_reminder",
  "payment_reminder",
  "overdue_reminder",
  "payment_received",
  "thank_you_follow_up",
] as const;
export const COMMUNICATION_ACTION_STATUSES = ["whatsapp_opened", "email_draft_opened"] as const;

export type CommunicationChannel = (typeof COMMUNICATION_CHANNELS)[number];
export type CommunicationTemplateType = (typeof COMMUNICATION_TEMPLATE_TYPES)[number];
export type CommunicationActionStatus = (typeof COMMUNICATION_ACTION_STATUSES)[number];

const safeMetadataValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const clientCommunicationSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  customerId: z.string().min(1),
  bookingId: z.string().min(1).nullable(),
  actorUserId: z.string().min(1).nullable(),
  channel: z.enum(COMMUNICATION_CHANNELS),
  templateType: z.enum(COMMUNICATION_TEMPLATE_TYPES),
  actionStatus: z.enum(COMMUNICATION_ACTION_STATUSES),
  recipientSnapshot: z.string().trim().min(1).max(320),
  subject: z.string().max(200).nullable(),
  bodySnapshot: z.string().min(1).max(4000),
  providerReference: z.string().max(500).nullable(),
  metadata: z.record(z.string(), safeMetadataValueSchema),
  createdAt: z.string().datetime({ offset: true }),
  openedAt: z.string().datetime({ offset: true }).nullable(),
});

export type ClientCommunication = z.infer<typeof clientCommunicationSchema>;

export type CommunicationContext = {
  customerId: string;
  bookingId?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  businessName: string;
  serviceName: string;
  bookingDate: string;
  dueDate: string;
  bookingValue: number;
  totalPaid: number;
  remainingAmount: number;
  nextSessionDate?: string;
};

export type CreateCommunicationInput = {
  customerId: string;
  bookingId?: string | null;
  channel: CommunicationChannel;
  templateType: CommunicationTemplateType;
  actionStatus: CommunicationActionStatus;
  recipientSnapshot: string;
  subject?: string | null;
  bodySnapshot: string;
  metadata?: ClientCommunication["metadata"];
};
