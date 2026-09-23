import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createCloudAdminClient, logCloudFailure } from "@/lib/supabase/admin";
import {
  exchangeGoogleCalendarCode,
  googleCalendarApi,
  googleCalendarAuthorizationUrl,
  googleCalendarCodeChallenge,
  googleCalendarCodeVerifier,
  googleCalendarConfigured,
  googleCalendarOAuthState,
  googleCalendarStateHash,
  GoogleCalendarApiError,
  type GoogleCalendarList,
  type GoogleTokenResponse,
  refreshGoogleCalendarToken,
  revokeGoogleCalendarToken,
} from "./googleApi";

export type CloudCalendarIntegration = {
  id: string;
  business_id: string;
  provider: "google_calendar";
  status: "connected" | "disconnected" | "error" | "reconnect_required";
  external_account_id: string | null;
  destination_id: string | null;
  credential_secret_id: string | null;
  connected_at: string | null;
  last_sync_at: string | null;
  last_sync_attempt_at: string | null;
  last_error: string | null;
  updated_at: string;
};

type StoredGoogleCredentials = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  scope?: string;
  token_type?: string;
};

export type CloudCalendarStatus = {
  configured: boolean;
  status: "unavailable" | "disconnected" | "connected" | "error" | "reconnect_required";
  googleAccount: string | null;
  targetCalendarId: string | null;
  lastSyncAt: string | null;
  lastSyncAttemptAt: string | null;
  lastError: string | null;
  calendars: Array<{ id: string; name: string; primary: boolean }>;
};

export class CloudCalendarError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "CloudCalendarError";
    this.code = code;
    this.status = status;
  }
}

type CalendarConnectionFailureClassification =
  | "authorization_rejected"
  | "provider_retryable"
  | "credential_store_error"
  | "unknown_retryable";

type CalendarConnectionFailureStage = "credential_read" | "token_refresh" | "credential_store";

class CalendarCredentialError extends Error {
  readonly stage: "credential_read" | "credential_store";

  constructor(stage: "credential_read" | "credential_store") {
    super("Google Calendar credential maintenance failed.");
    this.name = "CalendarCredentialError";
    this.stage = stage;
  }
}

const RECONNECT_REQUIRED_MESSAGE = "Google Calendar needs to be reconnected.";
const PROVIDER_RETRYABLE_MESSAGE = "Google Calendar could not be reached. Try again.";
const CREDENTIAL_RETRYABLE_MESSAGE = "Google Calendar credentials could not be accessed. Try again.";

const INTEGRATION_COLUMNS = [
  "id",
  "business_id",
  "provider",
  "status",
  "external_account_id",
  "destination_id",
  "credential_secret_id",
  "connected_at",
  "last_sync_at",
  "last_sync_attempt_at",
  "last_error",
  "updated_at",
].join(",");

function adminClient(): SupabaseClient {
  return createCloudAdminClient();
}

function throwDatabaseError(): never {
  throw new CloudCalendarError("storage_error", "Google Calendar settings could not be saved.", 500);
}

function writableCalendars(list: GoogleCalendarList) {
  return (list.items ?? [])
    .filter((item) => Boolean(item.id) && (item.accessRole === "owner" || item.accessRole === "writer"))
    .map((item) => ({ id: item.id, name: item.summary || item.id, primary: Boolean(item.primary) }));
}

async function integrationForBusiness(
  admin: SupabaseClient,
  businessId: string,
): Promise<CloudCalendarIntegration | null> {
  const { data, error } = await admin
    .from("integrations")
    .select(INTEGRATION_COLUMNS)
    .eq("business_id", businessId)
    .eq("provider", "google_calendar")
    .maybeSingle();
  if (error) throwDatabaseError();
  return data as CloudCalendarIntegration | null;
}

async function ensureIntegration(
  admin: SupabaseClient,
  businessId: string,
): Promise<CloudCalendarIntegration> {
  const existing = await integrationForBusiness(admin, businessId);
  if (existing) return existing;

  const { data, error } = await admin
    .from("integrations")
    .insert({ business_id: businessId, provider: "google_calendar", status: "disconnected" })
    .select(INTEGRATION_COLUMNS)
    .single();
  if (error || !data) throwDatabaseError();
  return data as unknown as CloudCalendarIntegration;
}

async function readCredentials(
  admin: SupabaseClient,
  businessId: string,
  integrationId: string,
): Promise<StoredGoogleCredentials> {
  const { data, error } = await admin.rpc("read_google_calendar_credentials", {
    target_business_id: businessId,
    target_integration_id: integrationId,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new CalendarCredentialError("credential_read");
  }
  return data as StoredGoogleCredentials;
}

async function storeCredentials(
  admin: SupabaseClient,
  businessId: string,
  integrationId: string,
  credentials: StoredGoogleCredentials,
): Promise<void> {
  const { error } = await admin.rpc("store_google_calendar_credentials", {
    target_business_id: businessId,
    target_integration_id: integrationId,
    credential_payload: credentials,
  });
  if (error) throw new CalendarCredentialError("credential_store");
}

async function updateIntegration(
  admin: SupabaseClient,
  businessId: string,
  integrationId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin
    .from("integrations")
    .update(values)
    .eq("business_id", businessId)
    .eq("id", integrationId)
    .eq("provider", "google_calendar");
  if (error) throwDatabaseError();
}

function classifyConnectionFailure(error: unknown): CalendarConnectionFailureClassification {
  if (error instanceof CalendarCredentialError) return "credential_store_error";
  if (error instanceof GoogleCalendarApiError) {
    return error.providerCode === "invalid_grant"
      ? "authorization_rejected"
      : "provider_retryable";
  }
  return "unknown_retryable";
}

function logConnectionFailure(input: {
  error: unknown;
  stage: CalendarConnectionFailureStage;
  classification: CalendarConnectionFailureClassification;
}) {
  const providerError = input.error instanceof GoogleCalendarApiError ? input.error : null;
  logCloudFailure("Google Calendar credential maintenance", {
    name: "GoogleCalendarConnectionFailure",
    message: "Google Calendar credential maintenance failed.",
    code: input.classification,
    stage: input.stage,
    details: providerError?.providerCode ?? undefined,
    status: providerError?.status,
  });
}

function retryableMessage(classification: CalendarConnectionFailureClassification): string {
  return classification === "credential_store_error"
    ? CREDENTIAL_RETRYABLE_MESSAGE
    : PROVIDER_RETRYABLE_MESSAGE;
}

async function throwClassifiedConnectionFailure(input: {
  admin: SupabaseClient;
  businessId: string;
  integration: CloudCalendarIntegration;
  error: unknown;
  stage: CalendarConnectionFailureStage;
}): Promise<never> {
  const classification = classifyConnectionFailure(input.error);
  const reconnect = classification === "authorization_rejected";
  const lastError = reconnect ? RECONNECT_REQUIRED_MESSAGE : retryableMessage(classification);
  logConnectionFailure({ error: input.error, stage: input.stage, classification });
  await updateIntegration(input.admin, input.businessId, input.integration.id, {
    status: reconnect ? "reconnect_required" : "error",
    last_error: lastError,
  }).catch(() => undefined);
  throw new CloudCalendarError(
    reconnect ? "reconnect_required" : "connection_retryable",
    lastError,
    reconnect ? 409 : 503,
  );
}

function hasRetryableConnectionError(integration: CloudCalendarIntegration): boolean {
  return integration.status === "error"
    && (integration.last_error === PROVIDER_RETRYABLE_MESSAGE
      || integration.last_error === CREDENTIAL_RETRYABLE_MESSAGE);
}

export async function beginCloudGoogleCalendarOAuth(
  businessId: string,
  userId: string,
): Promise<string> {
  if (!googleCalendarConfigured()) {
    throw new CloudCalendarError("not_configured", "Google Calendar is not configured.", 503);
  }
  const state = googleCalendarOAuthState();
  const verifier = googleCalendarCodeVerifier();
  const admin = adminClient();
  const { error } = await admin.rpc("create_google_calendar_oauth_state", {
    target_business_id: businessId,
    target_user_id: userId,
    target_state_hash: googleCalendarStateHash(state),
    target_pkce_verifier: verifier,
    target_expires_at: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
  });
  if (error) throwDatabaseError();
  return googleCalendarAuthorizationUrl(state, googleCalendarCodeChallenge(verifier));
}

export async function completeCloudGoogleCalendarOAuth(input: {
  businessId: string;
  userId: string;
  code: string;
  state: string;
}): Promise<void> {
  const admin = adminClient();
  const { data: consumed, error: consumeError } = await admin.rpc(
    "consume_google_calendar_oauth_state",
    {
      target_business_id: input.businessId,
      target_user_id: input.userId,
      target_state_hash: googleCalendarStateHash(input.state),
    },
  );
  const stateRow = Array.isArray(consumed) ? consumed[0] : consumed;
  const verifier = stateRow && typeof stateRow === "object"
    ? (stateRow as { pkce_verifier?: unknown }).pkce_verifier
    : null;
  if (consumeError || typeof verifier !== "string") {
    throw new CloudCalendarError("invalid_state", "Google Calendar connection expired. Try again.", 400);
  }

  const tokens = await exchangeGoogleCalendarCode(input.code, verifier);
  const list = await googleCalendarApi<GoogleCalendarList>(
    tokens.access_token,
    "/users/me/calendarList?minAccessRole=writer",
  );
  const calendars = writableCalendars(list);
  const primary = calendars.find((calendar) => calendar.primary) ?? calendars[0];
  if (!primary) {
    throw new CloudCalendarError("calendar_permission", "No writable Google Calendar is available.", 400);
  }

  const integration = await ensureIntegration(admin, input.businessId);
  const accountChanged = Boolean(
    integration.external_account_id
      && integration.external_account_id !== primary.id,
  );
  if (accountChanged) {
    const { count, error: countError } = await admin
      .from("calendar_event_links")
      .select("id", { count: "exact", head: true })
      .eq("business_id", input.businessId)
      .eq("integration_id", integration.id);
    if (countError) throwDatabaseError();
    if ((count ?? 0) > 0) {
      throw new CloudCalendarError(
        "account_mismatch",
        "Reconnect the same Google account while synced schedules still exist.",
        409,
      );
    }
  }

  const destinationId = calendars.some((calendar) => calendar.id === integration.destination_id)
    ? integration.destination_id!
    : primary.id;
  await storeCredentials(admin, input.businessId, integration.id, {
    access_token: tokens.access_token,
    ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    expires_at: new Date(Date.now() + tokens.expires_in * 1_000).toISOString(),
    scope: tokens.scope ?? "",
    token_type: tokens.token_type,
  });
  await updateIntegration(admin, input.businessId, integration.id, {
    status: "connected",
    external_account_id: primary.id,
    destination_id: destinationId,
    connected_at: new Date().toISOString(),
    last_error: null,
  });
}

export async function markCloudGoogleCalendarReconnectRequired(
  businessId: string,
  integrationId: string,
): Promise<void> {
  const admin = adminClient();
  await updateIntegration(admin, businessId, integrationId, {
    status: "reconnect_required",
    last_error: RECONNECT_REQUIRED_MESSAGE,
  }).catch(() => undefined);
}

export async function cloudGoogleCalendarAccess(
  businessId: string,
): Promise<{
  accessToken: string;
  integration: CloudCalendarIntegration;
}> {
  const admin = adminClient();
  const integration = await integrationForBusiness(admin, businessId);
  if (!integration || integration.status === "disconnected") {
    throw new CloudCalendarError("not_connected", "Google Calendar is not connected.", 409);
  }
  if (!integration.credential_secret_id) {
    await markCloudGoogleCalendarReconnectRequired(businessId, integration.id);
    throw new CloudCalendarError("reconnect_required", RECONNECT_REQUIRED_MESSAGE, 409);
  }

  let credentials: StoredGoogleCredentials;
  try {
    credentials = await readCredentials(admin, businessId, integration.id);
  } catch (error) {
    return throwClassifiedConnectionFailure({
      admin,
      businessId,
      integration,
      error,
      stage: "credential_read",
    });
  }

  let accessToken = credentials.access_token?.trim() ?? "";
  const expiresAt = credentials.expires_at ? Date.parse(credentials.expires_at) : 0;
  const forceRefreshValidation = integration.status === "reconnect_required";
  const needsRefresh = forceRefreshValidation
    || !accessToken
    || !Number.isFinite(expiresAt)
    || expiresAt < Date.now() + 60_000;
  if (needsRefresh) {
    const refreshToken = credentials.refresh_token?.trim();
    if (!refreshToken) {
      await markCloudGoogleCalendarReconnectRequired(businessId, integration.id);
      throw new CloudCalendarError("reconnect_required", RECONNECT_REQUIRED_MESSAGE, 409);
    }
    let refreshed: GoogleTokenResponse;
    try {
      refreshed = await refreshGoogleCalendarToken(refreshToken);
      accessToken = refreshed.access_token;
    } catch (error) {
      return throwClassifiedConnectionFailure({
        admin,
        businessId,
        integration,
        error,
        stage: "token_refresh",
      });
    }
    try {
      await storeCredentials(admin, businessId, integration.id, {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token?.trim() || refreshToken,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1_000).toISOString(),
        scope: refreshed.scope ?? credentials.scope ?? "",
        token_type: refreshed.token_type,
      });
    } catch (error) {
      return throwClassifiedConnectionFailure({
        admin,
        businessId,
        integration,
        error,
        stage: "credential_store",
      });
    }
  }

  if (integration.status === "reconnect_required") {
    await updateIntegration(admin, businessId, integration.id, {
      status: "connected",
      last_error: null,
    });
    return {
      accessToken,
      integration: { ...integration, status: "connected", last_error: null },
    };
  }

  return { accessToken, integration };
}

export async function getCloudGoogleCalendarStatus(
  businessId: string,
): Promise<CloudCalendarStatus> {
  if (!googleCalendarConfigured()) {
    return {
      configured: false,
      status: "unavailable",
      googleAccount: null,
      targetCalendarId: null,
      lastSyncAt: null,
      lastSyncAttemptAt: null,
      lastError: null,
      calendars: [],
    };
  }
  const admin = adminClient();
  let integration = await integrationForBusiness(admin, businessId);
  if (!integration || integration.status === "disconnected") {
    return {
      configured: true,
      status: "disconnected",
      googleAccount: integration?.external_account_id ?? null,
      targetCalendarId: integration?.destination_id ?? null,
      lastSyncAt: integration?.last_sync_at ?? null,
      lastSyncAttemptAt: integration?.last_sync_attempt_at ?? null,
      lastError: null,
      calendars: [],
    };
  }
  try {
    const access = await cloudGoogleCalendarAccess(businessId);
    integration = access.integration;
    const list = await googleCalendarApi<GoogleCalendarList>(
      access.accessToken,
      "/users/me/calendarList?minAccessRole=writer",
    );
    const calendars = writableCalendars(list);
    const destinationAvailable = calendars.some((calendar) => calendar.id === integration!.destination_id);
    if (!destinationAvailable) {
      await updateIntegration(admin, businessId, integration.id, {
        status: "error",
        last_error: "Your selected calendar is no longer available.",
      });
      return {
        configured: true,
        status: "error",
        googleAccount: integration.external_account_id,
        targetCalendarId: integration.destination_id,
        lastSyncAt: integration.last_sync_at,
        lastSyncAttemptAt: integration.last_sync_attempt_at,
        lastError: "Your selected calendar is no longer available.",
        calendars,
      };
    }
    if (hasRetryableConnectionError(integration)) {
      await updateIntegration(admin, businessId, integration.id, {
        status: "connected",
        last_error: null,
      });
      integration = { ...integration, status: "connected", last_error: null };
    }
    return {
      configured: true,
      status: integration.status === "error" ? "error" : "connected",
      googleAccount: integration.external_account_id,
      targetCalendarId: integration.destination_id,
      lastSyncAt: integration.last_sync_at,
      lastSyncAttemptAt: integration.last_sync_attempt_at,
      lastError: integration.status === "error" ? integration.last_error : null,
      calendars,
    };
  } catch (error) {
    const reconnect = error instanceof CloudCalendarError && error.code === "reconnect_required";
    const lastError = reconnect
      ? RECONNECT_REQUIRED_MESSAGE
      : error instanceof CloudCalendarError
        ? error.message
        : PROVIDER_RETRYABLE_MESSAGE;
    await updateIntegration(admin, businessId, integration.id, {
      status: reconnect ? "reconnect_required" : "error",
      last_error: lastError,
    }).catch(() => undefined);
    return {
      configured: true,
      status: reconnect ? "reconnect_required" : "error",
      googleAccount: integration.external_account_id,
      targetCalendarId: integration.destination_id,
      lastSyncAt: integration.last_sync_at,
      lastSyncAttemptAt: integration.last_sync_attempt_at,
      lastError,
      calendars: [],
    };
  }
}

export async function selectCloudGoogleCalendar(
  businessId: string,
  calendarId: string,
): Promise<void> {
  const admin = adminClient();
  const access = await cloudGoogleCalendarAccess(businessId);
  const list = await googleCalendarApi<GoogleCalendarList>(
    access.accessToken,
    "/users/me/calendarList?minAccessRole=writer",
  );
  if (!writableCalendars(list).some((calendar) => calendar.id === calendarId)) {
    throw new CloudCalendarError("calendar_unavailable", "Choose a writable Google Calendar.", 400);
  }
  await updateIntegration(admin, businessId, access.integration.id, {
    destination_id: calendarId,
    status: "connected",
    last_error: null,
  });
}

export async function disconnectCloudGoogleCalendar(
  businessId: string,
): Promise<{ revoked: boolean }> {
  const admin = adminClient();
  const integration = await integrationForBusiness(admin, businessId);
  if (!integration) return { revoked: false };

  let revoked = false;
  if (integration.credential_secret_id) {
    try {
      const credentials = await readCredentials(admin, businessId, integration.id);
      const token = credentials.refresh_token || credentials.access_token;
      if (token) revoked = await revokeGoogleCalendarToken(token);
    } catch {
      // Local disconnection must still remove an unusable credential secret.
    }
    const { error } = await admin.rpc("delete_google_calendar_credentials", {
      target_business_id: businessId,
      target_integration_id: integration.id,
    });
    if (error) throwDatabaseError();
  } else {
    await updateIntegration(admin, businessId, integration.id, {
      status: "disconnected",
      connected_at: null,
      last_error: null,
    });
  }
  return { revoked };
}

export async function getCloudCalendarIntegration(
  businessId: string,
): Promise<CloudCalendarIntegration | null> {
  return integrationForBusiness(adminClient(), businessId);
}

export async function updateCloudCalendarIntegration(
  businessId: string,
  integrationId: string,
  values: Record<string, unknown>,
): Promise<void> {
  return updateIntegration(adminClient(), businessId, integrationId, values);
}
