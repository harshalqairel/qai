import { z } from "zod";
import {
  storedDateSchema,
  storedTimeSchema,
  storedTimestampSchema,
} from "@/lib/persistence";
import { BOOKING_STATUSES } from "./constants";
import { MAX_BOOKING_SESSIONS } from "./constants";

const storedInstantSchema = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  "Invalid schedule timestamp.",
);

export const bookingSessionFormSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().max(80, "Label must be 80 characters or less."),
  date: z
    .string()
    .min(1, "Date is required.")
    .refine((value) => storedDateSchema.safeParse(value).success, "Invalid date."),
  startTime: z
    .string()
    .min(1, "Start time is required.")
    .refine((value) => storedTimeSchema.safeParse(value).success, "Invalid start time."),
  endTime: z
    .string()
    .min(1, "End time is required.")
    .refine((value) => storedTimeSchema.safeParse(value).success, "Invalid end time."),
  location: z.string().trim().max(240, "Location must be 240 characters or less."),
  notes: z.string().trim().max(1000, "Schedule notes must be 1,000 characters or less."),
});

export const bookingSchema = z
  .object({
    customerId: z.string().min(1, "Client is required."),
    serviceId: z.string().min(1, "Service is required."),
    sessions: z
      .array(bookingSessionFormSchema)
      .min(1, "At least one schedule is required.")
      .max(MAX_BOOKING_SESSIONS, `A booking can have up to ${MAX_BOOKING_SESSIONS} schedules.`),
    servicePrice: z.coerce.number().min(0, "Service price cannot be negative."),
    bookingStatus: z.enum(["Scheduled", "Completed", "Cancelled"]),
    fullPaymentDueDate: z.string().min(1, "Full payment due date is required."),
    notes: z.string().trim().or(z.literal("")),
  });

export type BookingFormValues = z.infer<typeof bookingSchema>;

export const bookingSessionRecordSchema = z.object({
  id: z.string().min(1),
  bookingId: z.string().min(1),
  sequence: z.number().int().positive(),
  label: z.string(),
  startAt: storedInstantSchema,
  endAt: storedInstantSchema,
  location: z.string(),
  notes: z.string(),
  createdAt: storedTimestampSchema,
  updatedAt: storedTimestampSchema,
});

export const bookingAdditionalChargeRecordSchema = z.object({
  id: z.string().min(1),
  bookingId: z.string().min(1),
  sessionId: z.string().min(1).nullable(),
  categoryId: z.string().min(1),
  categoryName: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240),
  amount: z.number().finite().positive(),
  createdAt: storedTimestampSchema,
  updatedAt: storedTimestampSchema,
});

export const bookingRecordSchema = z
  .object({
    id: z.string().min(1),
    customerId: z.string().min(1),
    serviceId: z.string().min(1),
    sessions: z.array(bookingSessionRecordSchema).min(1).max(MAX_BOOKING_SESSIONS),
    servicePrice: z.number().finite().nonnegative(),
    additionalCharges: z.array(bookingAdditionalChargeRecordSchema).max(100).default([]),
    bookingStatus: z.enum(BOOKING_STATUSES),
    fullPaymentDueDate: storedDateSchema,
    notes: z.string(),
    createdAt: storedTimestampSchema,
    updatedAt: storedTimestampSchema,
  })
  .passthrough()
  .superRefine((booking, context) => {
    const sequences = new Set<number>();
    for (const session of booking.sessions) {
      if (session.bookingId !== booking.id) {
        context.addIssue({ code: "custom", message: "Schedule belongs to another booking." });
      }
      if (sequences.has(session.sequence)) {
        context.addIssue({ code: "custom", message: "Schedule sequence must be unique." });
      }
      sequences.add(session.sequence);
      if (Date.parse(session.endAt) <= Date.parse(session.startAt)) {
        context.addIssue({ code: "custom", message: "Schedule end must be after its start." });
      }
    }
    const sessionIds = new Set(booking.sessions.map((session) => session.id));
    for (const charge of booking.additionalCharges) {
      if (charge.bookingId !== booking.id) context.addIssue({ code: "custom", message: "Additional charge belongs to another booking." });
      if (charge.sessionId && !sessionIds.has(charge.sessionId)) context.addIssue({ code: "custom", message: "Additional charge schedule was not found." });
    }
  });
