import { z } from "zod";

import { NOTIFICATION_CATEGORIES } from "./notificationPreferences";

const categoryIds = NOTIFICATION_CATEGORIES.map((category) => category.id);

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(4096).refine((value) => value.startsWith("https://"), "Push endpoint must use HTTPS."),
  expirationTime: z.number().int().positive().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+={0,2}$/),
    auth: z.string().min(1).max(512).regex(/^[A-Za-z0-9_-]+={0,2}$/),
  }),
});

export const pushCategoriesSchema = z.array(z.enum(categoryIds as [typeof categoryIds[number], ...typeof categoryIds])).max(categoryIds.length);
export type StoredPushSubscription = z.infer<typeof pushSubscriptionSchema>;

export function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function currentPushEnvironment(): "supported" | "unsupported" | "ios-install-required" {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return ios && !standalone ? "ios-install-required" : "supported";
}

export async function getPushRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  return navigator.serviceWorker.ready;
}

export async function subscribeCurrentDevice(publicKey: string): Promise<PushSubscription> {
  const registration = await getPushRegistration();
  const current = await registration.pushManager.getSubscription();
  if (current) return current;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
}
