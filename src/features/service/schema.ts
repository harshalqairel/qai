import { z } from "zod";

const serviceOptionValueSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  active: z.boolean(),
  position: z.number().int().min(0).max(1000),
});

const serviceOptionGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  position: z.number().int().min(0).max(1000),
  values: z.array(serviceOptionValueSchema).min(1).max(12),
});

const serviceVariantSchema = z.object({
  id: z.string().min(1),
  optionValueIds: z.array(z.string().min(1)).min(1).max(4),
  displayLabel: z.string().trim().max(120),
  price: z.number().finite().nonnegative(),
  duration: z.number().finite().positive(),
  defaultSessionCount: z.number().int().min(1).max(50),
  active: z.boolean(),
});

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const serviceAvailabilitySchema = z.object({
  mode: z.enum(["Flexible", "Recurring times", "Dated sessions"]),
  capacityMode: z.enum(["One booking", "Multiple bookings"]),
  defaultCapacity: z.number().int().min(1).max(10000),
  recurringTimes: z.array(z.object({
    id: z.string().min(1).max(100), weekday: z.number().int().min(0).max(6), startTime: timeSchema,
    capacity: z.number().int().min(1).max(10000).nullable(), manualBlocked: z.number().int().min(0).max(10000),
  })).max(100),
  datedSessions: z.array(z.object({
    id: z.string().min(1).max(100), date: dateSchema, startTime: timeSchema, endTime: timeSchema,
    location: z.string().trim().max(300), capacity: z.number().int().min(1).max(10000).nullable(),
    manualBlocked: z.number().int().min(0).max(10000), active: z.boolean(),
  })).max(500),
  overrides: z.array(z.object({
    id: z.string().min(1).max(100), date: dateSchema, startTime: timeSchema,
    capacity: z.number().int().min(1).max(10000).nullable(), manualBlocked: z.number().int().min(0).max(10000), unavailable: z.boolean(),
  })).max(500),
}).superRefine((availability, context) => {
  const duplicate = <T>(items: readonly T[], keyFor: (item: T) => string, path: string) => {
    const seen = new Set<string>();
    items.forEach((item, index) => {
      const key = keyFor(item);
      if (seen.has(key)) context.addIssue({ code: "custom", path: [path, index], message: "Each available time must be unique." });
      seen.add(key);
    });
  };
  duplicate(availability.recurringTimes, (slot) => `${slot.weekday}:${slot.startTime}`, "recurringTimes");
  duplicate(availability.datedSessions, (slot) => `${slot.date}:${slot.startTime}`, "datedSessions");
  duplicate(availability.overrides, (slot) => `${slot.date}:${slot.startTime}`, "overrides");
});

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

  locationPolicy: z.enum(["Business/studio only", "Client location only", "Client can choose", "Online"]),

  optionGroups: z.array(serviceOptionGroupSchema).max(4).default([]),

  variants: z.array(serviceVariantSchema).max(200).default([]),

  availability: serviceAvailabilitySchema.default({ mode: "Flexible", capacityMode: "One booking", defaultCapacity: 1, recurringTimes: [], datedSessions: [], overrides: [] }),

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
    locationPolicy: z.enum(["Business/studio only", "Client location only", "Client can choose", "Online"]).default("Client can choose"),
    optionGroups: z.array(serviceOptionGroupSchema).max(4).default([]),
    variants: z.array(serviceVariantSchema).max(200).default([]),
    availability: serviceAvailabilitySchema.default({ mode: "Flexible", capacityMode: "One booking", defaultCapacity: 1, recurringTimes: [], datedSessions: [], overrides: [] }),
    description: z.string(),
    active: z.boolean(),
  })
  .passthrough();
