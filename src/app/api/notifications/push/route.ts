import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isCloudModeEnabled, isValidationModeEnabled } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createValidationAdminClient } from "@/lib/validation/admin";
import { requireValidationSession } from "@/lib/validation/session";
import { pushCategoriesSchema, pushSubscriptionSchema } from "@/features/notifications/pushSubscription";
import { sendWebPush, webPushStatus } from "@/features/notifications/webPushServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const subscribeSchema = z.object({ action: z.literal("subscribe"), subscription: pushSubscriptionSchema, categories: pushCategoriesSchema, userAgent: z.string().max(500).default("") });
const testSchema = z.object({ action: z.literal("test"), endpoint: z.url().max(4096) });
const postSchema = z.discriminatedUnion("action", [subscribeSchema, testSchema]);
const unsubscribeSchema = z.object({ endpoint: z.url().max(4096) });

type OwnerScope = { kind: "validation"; workspaceId: string } | { kind: "cloud"; businessId: string; userId: string; client: Awaited<ReturnType<typeof createClient>> };

async function ownerScope(): Promise<OwnerScope> {
  if (isValidationModeEnabled()) return { kind: "validation", workspaceId: (await requireValidationSession()).workspaceId };
  if (!isCloudModeEnabled()) throw new Error("PUSH_REQUIRES_CLOUD");
  const client = await createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("AUTH_REQUIRED");
  const { data: membership } = await client.from("business_memberships").select("business_id").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!membership?.business_id) throw new Error("BUSINESS_REQUIRED");
  return { kind: "cloud", businessId: membership.business_id, userId: auth.user.id, client };
}

async function matchingRow(scope: OwnerScope, endpoint: string) {
  if (scope.kind === "validation") return createValidationAdminClient().from("push_subscriptions").select("id, endpoint, expiration_time, p256dh, auth").eq("validation_workspace_id", scope.workspaceId).eq("endpoint", endpoint).maybeSingle();
  return scope.client.from("push_subscriptions").select("id, endpoint, expiration_time, p256dh, auth").eq("business_id", scope.businessId).eq("user_id", scope.userId).eq("endpoint", endpoint).maybeSingle();
}

export async function GET(request: NextRequest) {
  try { const scope = await ownerScope(); const endpoint = request.nextUrl.searchParams.get("endpoint"); const subscribed = endpoint ? Boolean((await matchingRow(scope, endpoint)).data) : false; return NextResponse.json({ data: { ...webPushStatus(), subscribed } }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ data: { configured: false, publicKey: "" } }, { headers: { "Cache-Control": "no-store" } }); }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await ownerScope();
    const input = postSchema.parse(await request.json());
    if (input.action === "subscribe") {
      if (!webPushStatus().configured) return NextResponse.json({ error: "Push delivery is not configured for this deployment." }, { status: 503 });
      const shared = { endpoint: input.subscription.endpoint, expiration_time: input.subscription.expirationTime ?? null, p256dh: input.subscription.keys.p256dh, auth: input.subscription.keys.auth, categories: input.categories, user_agent: input.userAgent, updated_at: new Date().toISOString() };
      const result = scope.kind === "validation"
        ? await createValidationAdminClient().from("push_subscriptions").upsert({ ...shared, validation_workspace_id: scope.workspaceId, business_id: null, user_id: null }, { onConflict: "validation_workspace_id,endpoint" })
        : await scope.client.from("push_subscriptions").upsert({ ...shared, validation_workspace_id: null, business_id: scope.businessId, user_id: scope.userId }, { onConflict: "business_id,user_id,endpoint" });
      const { error } = result;
      if (error) throw error;
      return NextResponse.json({ data: { subscribed: true } });
    }
    const { data: row } = await matchingRow(scope, input.endpoint);
    if (!row) return NextResponse.json({ error: "This device is not subscribed." }, { status: 404 });
    const result = await sendWebPush({ endpoint: row.endpoint, expirationTime: row.expiration_time, keys: { p256dh: row.p256dh, auth: row.auth } }, { title: "Qai notifications are working", body: "This is a real server-originated test for this device.", url: "/settings?section=notifications", tag: "qai-push-test" });
    if (result === "expired") {
      const query = scope.kind === "validation" ? createValidationAdminClient().from("push_subscriptions") : scope.client.from("push_subscriptions");
      await query.delete().eq("id", row.id);
      return NextResponse.json({ error: "This device subscription expired. Turn notifications on again." }, { status: 410 });
    }
    return NextResponse.json({ data: { sent: true } });
  } catch (error) {
    const message = error instanceof Error && error.message === "WEB_PUSH_NOT_CONFIGURED" ? "Push delivery is not configured for this deployment." : "Could not update push notifications.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await ownerScope(); const { endpoint } = unsubscribeSchema.parse(await request.json());
    const query = scope.kind === "validation" ? createValidationAdminClient().from("push_subscriptions") : scope.client.from("push_subscriptions");
    let deletion = query.delete().eq("endpoint", endpoint);
    deletion = scope.kind === "validation" ? deletion.eq("validation_workspace_id", scope.workspaceId) : deletion.eq("business_id", scope.businessId).eq("user_id", scope.userId);
    await deletion;
    return NextResponse.json({ data: { subscribed: false } });
  } catch { return NextResponse.json({ error: "Could not turn off push notifications." }, { status: 400 }); }
}
