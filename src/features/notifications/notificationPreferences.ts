import { z } from "zod";

import { readVersionedCollection, writeVersionedCollection } from "@/lib/persistence";

export const NOTIFICATION_CATEGORIES = [
  { id: "bookingRequests", label: "New booking or request" },
  { id: "bookingChanges", label: "Booking changed or cancelled" },
  { id: "upcomingSchedules", label: "Upcoming schedule" },
  { id: "paymentDue", label: "Payment due or overdue" },
  { id: "invoiceDue", label: "Invoice due" },
  { id: "calendarProblems", label: "Calendar sync problem" },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["id"];

const categorySchema = z.enum([
  "bookingRequests",
  "bookingChanges",
  "upcomingSchedules",
  "paymentDue",
  "invoiceDue",
  "calendarProblems",
]);

const preferencesSchema = z.object({
  userId: z.string().min(1),
  enabled: z.boolean(),
  categories: z.array(categorySchema),
});

export type NotificationPreferences = z.infer<typeof preferencesSchema>;

const STORAGE_KEY = "qai:notification-preferences";
const LOCAL_USER_ID = "local-user";
const DEFAULT_CATEGORIES = NOTIFICATION_CATEGORIES.map((category) => category.id);

export function defaultNotificationPreferences(userId = LOCAL_USER_ID): NotificationPreferences {
  return { userId, enabled: false, categories: [...DEFAULT_CATEGORIES] };
}

export function getNotificationPreferences(userId = LOCAL_USER_ID): NotificationPreferences {
  return readVersionedCollection(STORAGE_KEY, preferencesSchema)
    .find((record) => record.userId === userId) ?? defaultNotificationPreferences(userId);
}

export function saveNotificationPreferences(preferences: NotificationPreferences): void {
  const parsed = preferencesSchema.parse(preferences);
  const current = readVersionedCollection(STORAGE_KEY, preferencesSchema);
  const next = current.some((record) => record.userId === parsed.userId)
    ? current.map((record) => record.userId === parsed.userId ? parsed : record)
    : [...current, parsed];
  writeVersionedCollection(STORAGE_KEY, preferencesSchema, next);
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return window.Notification.requestPermission();
}
