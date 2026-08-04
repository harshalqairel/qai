import { z } from "zod";
import {
  storedDateSchema,
  storedTimeSchema,
  storedTimestampSchema,
} from "@/lib/persistence";
import { BOOKING_STATUSES } from "./constants";

export const bookingSchema = z
  .object({
    customerId: z.string().min(1, "Customer is required."),
    serviceId: z.string().min(1, "Service is required."),
    bookingDate: z
      .string()
      .min(1, "Booking date is required.")
      .refine((value) => storedDateSchema.safeParse(value).success, "Invalid booking date."),
    startTime: z
      .string()
      .min(1, "Start time is required.")
      .refine((value) => storedTimeSchema.safeParse(value).success, "Invalid start time."),
    endTime: z
      .string()
      .min(1, "End time is required.")
      .refine((value) => storedTimeSchema.safeParse(value).success, "Invalid end time."),
    location: z.string().trim(),
    servicePrice: z.coerce.number().min(0, "Service price cannot be negative."),
    bookingStatus: z.enum(["Scheduled", "Completed", "Cancelled"]),
    fullPaymentDueDate: z.string().min(1, "Full payment due date is required."),
    notes: z.string().trim().or(z.literal("")),
  });

export type BookingFormValues = z.infer<typeof bookingSchema>;

export const bookingRecordSchema = z
  .object({
    id: z.string().min(1),
    customerId: z.string().min(1),
    serviceId: z.string().min(1),
    bookingDate: storedDateSchema,
    startTime: storedTimeSchema,
    endTime: storedTimeSchema,
    location: z.string(),
    servicePrice: z.number().finite().nonnegative(),
    bookingStatus: z.enum(BOOKING_STATUSES),
    fullPaymentDueDate: storedDateSchema,
    notes: z.string(),
    createdAt: storedTimestampSchema,
    updatedAt: storedTimestampSchema,
  })
  .passthrough();
