import { z } from "zod";
import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";

export const APPEARANCE_THEMES = [
  { id: "nocturne", name: "Nocturne", subtitle: "Dark slate with subtle teal." },
  { id: "serein", name: "Serein", subtitle: "Soft neutrals with muted sage." },
  { id: "bloom", name: "Bloom", subtitle: "Neutral tones with muted mauve." },
] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number]["id"];
export const DEFAULT_APPEARANCE_THEME: AppearanceTheme = "serein";
export const LOCAL_USER_ID = "local-user";

const STORAGE_KEY = "qai:user-appearance";
const recordSchema = z.object({
  userId: z.string().min(1),
  theme: z.enum(["nocturne", "serein", "bloom"]),
});

export function getAppearanceTheme(userId = LOCAL_USER_ID): AppearanceTheme {
  return readVersionedCollection(STORAGE_KEY, recordSchema)
    .find((record) => record.userId === userId)?.theme ?? DEFAULT_APPEARANCE_THEME;
}

export function saveAppearanceTheme(theme: AppearanceTheme, userId = LOCAL_USER_ID): void {
  const records = readVersionedCollection(STORAGE_KEY, recordSchema);
  const next = records.some((record) => record.userId === userId)
    ? records.map((record) => record.userId === userId ? { ...record, theme } : record)
    : [...records, { userId, theme }];
  writeVersionedCollection(STORAGE_KEY, recordSchema, next);
}

export function applyAppearanceTheme(theme: AppearanceTheme): void {
  document.documentElement.dataset.qaiTheme = theme;
}
