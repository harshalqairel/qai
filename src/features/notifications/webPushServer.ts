import "server-only";

import webPush from "web-push";

import { createCloudAdminClient } from "@/lib/supabase/admin";
import { createValidationAdminClient } from "@/lib/validation/admin";
import type { NotificationCategory } from "./notificationPreferences";
import { pushSubscriptionSchema, type StoredPushSubscription } from "./pushSubscription";
import { safePushPath } from "./pushSafety";

export type QaiPushPayload = { title: string; body: string; url: string; tag?: string };

function pushConfig() {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() ?? "";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey && /^(mailto:|https?:)/.test(subject)) };
}

export function webPushStatus() {
  const config = pushConfig();
  return { configured: config.configured, publicKey: config.configured ? config.publicKey : "" };
}

export async function sendWebPush(subscription: StoredPushSubscription, payload: QaiPushPayload): Promise<"sent" | "expired"> {
  const config = pushConfig();
  if (!config.configured) throw new Error("WEB_PUSH_NOT_CONFIGURED");
  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  try {
    await webPush.sendNotification(subscription, JSON.stringify({ ...payload, url: safePushPath(payload.url) }), { TTL: 60 * 60, urgency: "normal" });
    return "sent";
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
    if (statusCode === 404 || statusCode === 410) return "expired";
    throw error;
  }
}

export async function sendValidationWorkspacePush(workspaceId: string, category: NotificationCategory, payload: QaiPushPayload): Promise<void> {
  if (!pushConfig().configured) return;
  const admin = createValidationAdminClient();
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, expiration_time, p256dh, auth").eq("validation_workspace_id", workspaceId).contains("categories", [category]);
  await Promise.all((data ?? []).map(async (row) => {
    const subscription = pushSubscriptionSchema.parse({ endpoint: row.endpoint, expirationTime: row.expiration_time, keys: { p256dh: row.p256dh, auth: row.auth } });
    const result = await sendWebPush(subscription, payload).catch(() => "failed" as const);
    if (result === "expired") await admin.from("push_subscriptions").delete().eq("id", row.id);
  }));
}

export async function sendCloudBusinessPush(businessId: string, category: NotificationCategory, payload: QaiPushPayload): Promise<void> {
  if (!pushConfig().configured) return;
  const admin = createCloudAdminClient();
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, expiration_time, p256dh, auth").eq("business_id", businessId).contains("categories", [category]);
  await Promise.all((data ?? []).map(async (row) => {
    const subscription = pushSubscriptionSchema.parse({ endpoint: row.endpoint, expirationTime: row.expiration_time, keys: { p256dh: row.p256dh, auth: row.auth } });
    const result = await sendWebPush(subscription, payload).catch(() => "failed" as const);
    if (result === "expired") await admin.from("push_subscriptions").delete().eq("business_id", businessId).eq("id", row.id);
  }));
}
