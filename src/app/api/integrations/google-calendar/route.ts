import { NextResponse } from "next/server";
import { z } from "zod";

import {
  CloudCalendarError,
  disconnectCloudGoogleCalendar,
  getCloudGoogleCalendarStatus,
  selectCloudGoogleCalendar,
} from "@/lib/google-calendar/cloudConnection";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { requireCloudBusinessAdminContext } from "@/lib/supabase/cloudContext";
import { createValidationAdminClient } from "@/lib/validation/admin";
import { decryptValidationSecret } from "@/lib/validation/encryption";
import {
  googleApi,
  googleCalendarConfigured,
  workspaceGoogleAccessToken,
} from "@/lib/validation/googleCalendar";
import { requireValidationSession } from "@/lib/validation/session";

type CalendarList = {
  items?: Array<{ id: string; summary: string; primary?: boolean; accessRole?: string }>;
};

const selectSchema = z.object({ calendarId: z.string().trim().min(1).max(1024) });

function cloudFailure(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Choose a valid Google Calendar." }, { status: 400 });
  }
  if (error instanceof CloudCalendarError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Error && (error.message === "AUTH_REQUIRED" || error.message === "BUSINESS_REQUIRED")) {
    return NextResponse.json({ error: "Sign in to manage Google Calendar." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "BUSINESS_ADMIN_REQUIRED") {
    return NextResponse.json({ error: "Only a business owner or admin can manage Google Calendar." }, { status: 403 });
  }
  return NextResponse.json({ error: "Google Calendar settings are unavailable." }, { status: 500 });
}

export async function GET() {
  if (isCloudModeEnabled()) {
    try {
      const context = await requireCloudBusinessAdminContext();
      const data = await getCloudGoogleCalendarStatus(context.businessId);
      return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return cloudFailure(error);
    }
  }

  try {
    const session = await requireValidationSession();
    if (!googleCalendarConfigured()) {
      return NextResponse.json({ data: {
        configured: false,
        status: "unavailable",
        googleAccount: null,
        targetCalendarId: null,
        lastSyncAt: null,
        lastSyncAttemptAt: null,
        lastError: null,
        calendars: [],
      } });
    }
    const admin = createValidationAdminClient();
    const { data: row } = await admin
      .from("validation_calendar_connections")
      .select("status, google_account_email, target_calendar_id, last_sync_at, last_error, updated_at")
      .eq("workspace_id", session.workspaceId)
      .maybeSingle();
    if (!row || row.status === "disconnected") {
      return NextResponse.json({ data: {
        configured: true,
        status: "disconnected",
        googleAccount: row?.google_account_email ?? null,
        targetCalendarId: row?.target_calendar_id ?? null,
        lastSyncAt: row?.last_sync_at ?? null,
        lastSyncAttemptAt: null,
        lastError: null,
        calendars: [],
      } });
    }
    try {
      const { accessToken } = await workspaceGoogleAccessToken(session.workspaceId);
      const list = await googleApi<CalendarList>(accessToken, "/users/me/calendarList?minAccessRole=writer");
      return NextResponse.json({ data: {
        configured: true,
        status: row.status,
        googleAccount: row.google_account_email,
        targetCalendarId: row.target_calendar_id,
        lastSyncAt: row.last_sync_at,
        lastSyncAttemptAt: null,
        lastError: row.last_error,
        calendars: (list.items ?? [])
          .filter((item) => item.accessRole === "owner" || item.accessRole === "writer")
          .map((item) => ({ id: item.id, name: item.summary, primary: Boolean(item.primary) })),
      } }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ data: {
        configured: true,
        status: "reconnect_required",
        googleAccount: row.google_account_email,
        targetCalendarId: row.target_calendar_id,
        lastSyncAt: row.last_sync_at,
        lastSyncAttemptAt: null,
        lastError: "Google Calendar needs to be reconnected.",
        calendars: [],
      } });
    }
  } catch {
    return NextResponse.json({ error: "Validation access is required." }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  if (isCloudModeEnabled()) {
    try {
      const context = await requireCloudBusinessAdminContext();
      const { calendarId } = selectSchema.parse(await request.json());
      await selectCloudGoogleCalendar(context.businessId, calendarId);
      return NextResponse.json({ data: { ok: true } });
    } catch (error) {
      return cloudFailure(error);
    }
  }

  try {
    const session = await requireValidationSession();
    const { calendarId } = selectSchema.parse(await request.json());
    const { accessToken } = await workspaceGoogleAccessToken(session.workspaceId);
    const list = await googleApi<CalendarList>(accessToken, "/users/me/calendarList?minAccessRole=writer");
    if (!(list.items ?? []).some((item) => item.id === calendarId
      && (item.accessRole === "owner" || item.accessRole === "writer"))) {
      return NextResponse.json({ error: "Choose a writable calendar." }, { status: 400 });
    }
    const admin = createValidationAdminClient();
    const { error } = await admin
      .from("validation_calendar_connections")
      .update({ target_calendar_id: calendarId, updated_at: new Date().toISOString() })
      .eq("workspace_id", session.workspaceId);
    if (error) throw error;
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Could not select that calendar." }, { status: 400 });
  }
}

export async function DELETE() {
  if (isCloudModeEnabled()) {
    try {
      const context = await requireCloudBusinessAdminContext();
      const result = await disconnectCloudGoogleCalendar(context.businessId);
      return NextResponse.json({ data: { ok: true, ...result } });
    } catch (error) {
      return cloudFailure(error);
    }
  }

  try {
    const session = await requireValidationSession();
    const admin = createValidationAdminClient();
    const { data: row } = await admin
      .from("validation_calendar_connections")
      .select("encrypted_access_token")
      .eq("workspace_id", session.workspaceId)
      .maybeSingle();
    if (row?.encrypted_access_token) {
      const token = decryptValidationSecret(row.encrypted_access_token);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
      }).catch(() => undefined);
    }
    const { error } = await admin
      .from("validation_calendar_connections")
      .update({
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        token_expires_at: null,
        status: "disconnected",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", session.workspaceId);
    if (error) throw error;
    return NextResponse.json({ data: { ok: true } });
  } catch {
    return NextResponse.json({ error: "Could not disconnect Google Calendar." }, { status: 400 });
  }
}
