import { z } from "zod";

import { ServiceCategory } from "./types";

export const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Service name is required."),

  category: z.enum(ServiceCategory),

  price: z.coerce
    .number()
    .min(1, "Price must be greater than 0."),

  duration: z.coerce
    .number()
    .min(1, "Duration must be greater than 0."),

  description: z.string().trim(),

  active: z.boolean(),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;

export const serviceRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.enum(ServiceCategory),
    price: z.number().finite().positive(),
    duration: z.number().finite().positive(),
    description: z.string(),
    active: z.boolean(),
  })
  .passthrough();
