import { z } from "zod";

export const serviceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Service name is required."),

  categoryId: z.string().min(1, "Please choose a category."),

  price: z.coerce
    .number()
    .min(1, "Price must be greater than 0."),

  duration: z.coerce
    .number()
    .min(1, "Duration must be greater than 0."),

  defaultSessionCount: z.coerce
    .number()
    .int("Usual number of schedules must be a whole number.")
    .min(1, "Add at least one usual schedule.")
    .max(50, "Usual number of schedules cannot exceed 50."),

  description: z.string().trim(),

  active: z.boolean(),
});

export type ServiceFormValues = z.infer<typeof serviceSchema>;

export const serviceRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    categoryId: z.string().min(1),
    price: z.number().finite().positive(),
    duration: z.number().finite().positive(),
    defaultSessionCount: z.number().int().min(1).max(50),
    description: z.string(),
    active: z.boolean(),
  })
  .passthrough();
