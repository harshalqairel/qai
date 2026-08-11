import { z } from "zod";

export const categoryRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  color: z.string().trim().optional().transform((value) => value ?? ""),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
