import { z } from "zod";
import { storedTimestampSchema } from "@/lib/persistence";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Client name is required."),

  phone: z
    .string()
    .trim()
    .min(1, "Phone is required."),

  instagram: z.string().trim().or(z.literal("")),

  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")),

  notes: z.string().trim().or(z.literal("")),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

export const customerRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    phone: z.string().min(1),
    instagram: z.string(),
    email: z.string().email().or(z.literal("")),
    notes: z.string(),
    createdAt: storedTimestampSchema,
  })
  .passthrough();
