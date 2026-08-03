import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required."),

  phone: z
    .string()
    .trim()
    .min(1, "Phone is required."),

  instagram: z.string().trim().or(z.literal("")),

  email: z.string().trim().email("Invalid email address.").or(z.literal("")),

  notes: z.string().trim().or(z.literal("")),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
