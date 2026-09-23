import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  exchange: vi.fn(),
  googleApi: vi.fn(),
  refresh: vi.fn(),
  revoke: vi.fn(),
  logCloudFailure: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createCloudAdminClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
  logCloudFailure: mocks.logCloudFailure,
}));

vi.mock("./googleApi", () => ({
  GoogleCalendarApiError: class GoogleCalendarApiError extends Error {
    constructor(
      readonly status: number,
      readonly reason: string,
      readonly providerCode: string | null = null,
    ) {
      super("Google Calendar operation failed.");
      this.name = "GoogleCalendarApiError";
    }
  },
  exchangeGoogleCalendarCode: mocks.exchange,
  googleCalendarApi: mocks.googleApi,
  googleCalendarAuthorizationUrl: (state: string, challenge: string) => `https://accounts.example/auth?state=${state}&challenge=${challenge}`,
  googleCalendarCodeChallenge: () => "challenge",
  googleCalendarCodeVerifier: () => "v".repeat(48),
  googleCalendarConfigured: () => true,
  googleCalendarOAuthState: () => "oauth-state",
  googleCalendarStateHash: (state: string) => `hash-${state}`,
  refreshGoogleCalendarToken: mocks.refresh,
  revokeGoogleCalendarToken: mocks.revoke,
}));

import { GoogleCalendarApiError } from "./googleApi";

import {
  beginCloudGoogleCalendarOAuth,
  cloudGoogleCalendarAccess,
  completeCloudGoogleCalendarOAuth,
  disconnectCloudGoogleCalendar,
  getCloudGoogleCalendarStatus,
  selectCloudGoogleCalendar,
} from "./cloudConnection";

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };

function query(result: QueryResult) {
  const builder: Record<string, ReturnType<typeof vi.fn> | ((resolve: (value: QueryResult) => unknown) => Promise<unknown>)> = {};
  for (const method of ["select", "eq", "insert", "update", "delete"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

const integration = {
  id: "integration-a",
  business_id: "business-a",
  provider: "google_calendar",
  status: "connected",
  external_account_id: "owner@example.com",
  destination_id: "primary",
  credential_secret_id: "secret-a",
  connected_at: "2026-09-01T00:00:00.000Z",
  last_sync_at: null,
  last_sync_attempt_at: null,
  last_error: null,
  updated_at: "2026-09-01T00:00:00.000Z",
};

const calendarList = {
  items: [{ id: "owner@example.com", summary: "Primary", primary: true, accessRole: "owner" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exchange.mockResolvedValue({
    access_token: "new-access",
    refresh_token: "new-refresh",
    expires_in: 3600,
    scope: "calendar",
    token_type: "Bearer",
  });
  mocks.googleApi.mockResolvedValue(calendarList);
  mocks.refresh.mockResolvedValue({
    access_token: "refreshed-access",
    expires_in: 3600,
    scope: "calendar",
    token_type: "Bearer",
  });
  mocks.revoke.mockResolvedValue(true);
});

describe("cloud Google Calendar connection", () => {
  it("creates a business/user-bound hashed OAuth state with Vault-protected PKCE input", async () => {
    mocks.rpc.mockResolvedValue({ data: "state-id", error: null });

    await expect(beginCloudGoogleCalendarOAuth("business-a", "user-a"))
      .resolves.toBe("https://accounts.example/auth?state=oauth-state&challenge=challenge");
    expect(mocks.rpc).toHaveBeenCalledWith("create_google_calendar_oauth_state", {
      target_business_id: "business-a",
      target_user_id: "user-a",
      target_state_hash: "hash-oauth-state",
      target_pkce_verifier: "v".repeat(48),
      target_expires_at: expect.any(String),
    });
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain('target_state_hash":"oauth-state"');
  });

  it("consumes OAuth state once, stores credentials through the Vault RPC, and persists the destination", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "consume_google_calendar_oauth_state"
      ? { data: [{ pkce_verifier: "v".repeat(48) }], error: null }
      : { data: "secret-a", error: null });

    await completeCloudGoogleCalendarOAuth({
      businessId: "business-a",
      userId: "user-a",
      code: "authorization-code",
      state: "oauth-state",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("consume_google_calendar_oauth_state", {
      target_business_id: "business-a",
      target_user_id: "user-a",
      target_state_hash: "hash-oauth-state",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("store_google_calendar_credentials", expect.objectContaining({
      target_business_id: "business-a",
      target_integration_id: "integration-a",
      credential_payload: expect.objectContaining({ access_token: "new-access", refresh_token: "new-refresh" }),
    }));
    expect(integrationQuery.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "connected",
      external_account_id: "owner@example.com",
      destination_id: "owner@example.com",
    }));
  });

  it("blocks a different Google account while event mappings exist", async () => {
    const existing = { ...integration, external_account_id: "old@example.com" };
    const integrationQuery = query({ data: existing, error: null });
    const linkQuery = query({ data: null, error: null, count: 2 });
    mocks.from.mockImplementation((table: string) => table === "integrations" ? integrationQuery : linkQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "consume_google_calendar_oauth_state"
      ? { data: [{ pkce_verifier: "v".repeat(48) }], error: null }
      : { data: "secret-a", error: null });

    await expect(completeCloudGoogleCalendarOAuth({
      businessId: "business-a",
      userId: "user-a",
      code: "authorization-code",
      state: "oauth-state",
    })).rejects.toMatchObject({ code: "account_mismatch", status: 409 });
    expect(mocks.rpc).not.toHaveBeenCalledWith("store_google_calendar_credentials", expect.anything());
    expect(integrationQuery.update).not.toHaveBeenCalled();
  });

  it("stores a refreshed credential and returns Connected for an expired access token", async () => {
    const current = { ...integration, destination_id: "owner@example.com" };
    const integrationQuery = query({ data: current, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "read_google_calendar_credentials"
      ? {
          data: {
            access_token: "expired-access",
            refresh_token: "refresh-secret",
            expires_at: "2020-01-01T00:00:00.000Z",
          },
          error: null,
        }
      : { data: "secret-a", error: null });

    await expect(getCloudGoogleCalendarStatus("business-a")).resolves.toMatchObject({
      status: "connected",
      targetCalendarId: "owner@example.com",
    });
    expect(mocks.rpc).toHaveBeenCalledWith("store_google_calendar_credentials", expect.objectContaining({
      target_business_id: "business-a",
      target_integration_id: "integration-a",
      credential_payload: expect.objectContaining({
        access_token: "refreshed-access",
        refresh_token: "refresh-secret",
      }),
    }));
    expect(mocks.from).not.toHaveBeenCalledWith("calendar_event_links");
  });

  it("marks the integration reconnect_required only when Google rejects the refresh grant", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: { access_token: "expired", refresh_token: "refresh", expires_at: "2020-01-01T00:00:00.000Z" },
      error: null,
    });
    mocks.refresh.mockRejectedValue(
      new GoogleCalendarApiError(400, "authorization", "invalid_grant"),
    );

    await expect(cloudGoogleCalendarAccess("business-a"))
      .rejects.toMatchObject({ code: "reconnect_required" });
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "reconnect_required",
      last_error: "Google Calendar needs to be reconnected.",
    });
    expect(mocks.logCloudFailure).toHaveBeenCalledWith(
      "Google Calendar credential maintenance",
      expect.objectContaining({
        code: "authorization_rejected",
        stage: "token_refresh",
        details: "invalid_grant",
        status: 400,
      }),
    );
  });

  it.each([
    ["provider 500", new GoogleCalendarApiError(500, "authorization", "server_error")],
    ["network failure", new GoogleCalendarApiError(0, "network")],
  ])("keeps %s retryable instead of requiring reconnect", async (_label, failure) => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: {
        access_token: "expired",
        refresh_token: "refresh-secret",
        expires_at: "2020-01-01T00:00:00.000Z",
      },
      error: null,
    });
    mocks.refresh.mockRejectedValue(failure);

    await expect(cloudGoogleCalendarAccess("business-a"))
      .rejects.toMatchObject({
        code: "connection_retryable",
        message: "Google Calendar could not be reached. Try again.",
      });
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "error",
      last_error: "Google Calendar could not be reached. Try again.",
    });
    expect(integrationQuery.update).not.toHaveBeenCalledWith(expect.objectContaining({
      status: "reconnect_required",
    }));
    expect(mocks.rpc).not.toHaveBeenCalledWith("delete_google_calendar_credentials", expect.anything());
  });

  it("keeps a Vault credential-store failure retryable", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "read_google_calendar_credentials"
      ? {
          data: {
            access_token: "expired",
            refresh_token: "refresh-secret",
            expires_at: "2020-01-01T00:00:00.000Z",
          },
          error: null,
        }
      : { data: null, error: { code: "vault_write_failed" } });

    await expect(cloudGoogleCalendarAccess("business-a"))
      .rejects.toMatchObject({
        code: "connection_retryable",
        message: "Google Calendar credentials could not be accessed. Try again.",
      });
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "error",
      last_error: "Google Calendar credentials could not be accessed. Try again.",
    });
    expect(mocks.logCloudFailure).toHaveBeenCalledWith(
      "Google Calendar credential maintenance",
      expect.objectContaining({
        code: "credential_store_error",
        stage: "credential_store",
      }),
    );
  });

  it("keeps a Vault credential-read failure retryable", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "vault_read_failed" } });

    await expect(cloudGoogleCalendarAccess("business-a"))
      .rejects.toMatchObject({ code: "connection_retryable" });
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "error",
      last_error: "Google Calendar credentials could not be accessed. Try again.",
    });
    expect(mocks.logCloudFailure).toHaveBeenCalledWith(
      "Google Calendar credential maintenance",
      expect.objectContaining({
        code: "credential_store_error",
        stage: "credential_read",
      }),
    );
  });

  it("keeps the existing refresh token when Google rotates only the access token", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "read_google_calendar_credentials"
      ? {
          data: {
            access_token: "expired",
            refresh_token: "existing-refresh",
            expires_at: "2020-01-01T00:00:00.000Z",
            scope: "calendar",
          },
          error: null,
        }
      : { data: "secret-a", error: null });
    mocks.refresh.mockResolvedValue({
      access_token: "rotated-access",
      expires_in: 3600,
      scope: "calendar",
      token_type: "Bearer",
    });

    await expect(cloudGoogleCalendarAccess("business-a"))
      .resolves.toMatchObject({ accessToken: "rotated-access" });
    expect(mocks.rpc).toHaveBeenCalledWith("store_google_calendar_credentials", expect.objectContaining({
      target_business_id: "business-a",
      target_integration_id: "integration-a",
      credential_payload: expect.objectContaining({
        access_token: "rotated-access",
        refresh_token: "existing-refresh",
      }),
    }));
  });

  it("self-recovers a stale reconnect_required state without changing Calendar sync data", async () => {
    const staleReconnect = {
      ...integration,
      status: "reconnect_required",
      destination_id: "owner@example.com",
      last_sync_at: "2026-09-10T08:00:20.777Z",
      last_sync_attempt_at: "2026-09-10T08:00:17.485Z",
      last_error: "Google Calendar needs to be reconnected.",
    };
    const integrationQuery = query({ data: staleReconnect, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "read_google_calendar_credentials"
      ? {
          data: {
            access_token: "still-valid-but-must-be-validated",
            refresh_token: "refresh-secret",
            expires_at: "2099-01-01T00:00:00.000Z",
          },
          error: null,
        }
      : { data: "secret-a", error: null });

    await expect(getCloudGoogleCalendarStatus("business-a")).resolves.toMatchObject({
      status: "connected",
      targetCalendarId: "owner@example.com",
      lastSyncAt: "2026-09-10T08:00:20.777Z",
      lastSyncAttemptAt: "2026-09-10T08:00:17.485Z",
      lastError: null,
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "connected",
      last_error: null,
    });
    const updateMock = integrationQuery.update as ReturnType<typeof vi.fn>;
    const updates = updateMock.mock.calls.map((args) => args[0] as Record<string, unknown>);
    expect(updates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ destination_id: expect.anything() }),
    ]));
    expect(updates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ last_sync_at: expect.anything() }),
    ]));
    expect(updates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ last_sync_attempt_at: expect.anything() }),
    ]));
    expect(mocks.from).not.toHaveBeenCalledWith("calendar_event_links");
  });

  it("keeps a stale reconnect_required state when refresh validation returns invalid_grant", async () => {
    const staleReconnect = {
      ...integration,
      status: "reconnect_required",
      last_error: "Google Calendar needs to be reconnected.",
    };
    const integrationQuery = query({ data: staleReconnect, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: {
        access_token: "expired",
        refresh_token: "refresh-secret",
        expires_at: "2020-01-01T00:00:00.000Z",
      },
      error: null,
    });
    mocks.refresh.mockRejectedValue(
      new GoogleCalendarApiError(400, "authorization", "invalid_grant"),
    );

    await expect(getCloudGoogleCalendarStatus("business-a")).resolves.toMatchObject({
      status: "reconnect_required",
      lastError: "Google Calendar needs to be reconnected.",
    });
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "reconnect_required",
      last_error: "Google Calendar needs to be reconnected.",
    });
  });

  it("turns a stale reconnect transient failure into a retryable error and retains credentials", async () => {
    const staleReconnect = {
      ...integration,
      status: "reconnect_required",
      destination_id: "owner@example.com",
      last_error: "Google Calendar needs to be reconnected.",
    };
    const integrationQuery = query({ data: staleReconnect, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: {
        access_token: "expired",
        refresh_token: "refresh-secret",
        expires_at: "2020-01-01T00:00:00.000Z",
      },
      error: null,
    });
    mocks.refresh.mockRejectedValue(new GoogleCalendarApiError(503, "authorization", "temporarily_unavailable"));

    await expect(getCloudGoogleCalendarStatus("business-a")).resolves.toMatchObject({
      status: "error",
      targetCalendarId: "owner@example.com",
      lastError: "Google Calendar could not be reached. Try again.",
    });
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "error",
      last_error: "Google Calendar could not be reached. Try again.",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("delete_google_calendar_credentials", expect.anything());
    expect(integrationQuery.update).not.toHaveBeenCalledWith(expect.objectContaining({
      destination_id: expect.anything(),
    }));
  });

  it("requires reconnect when no usable refresh credential exists", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: { access_token: "expired", expires_at: "2020-01-01T00:00:00.000Z" },
      error: null,
    });

    await expect(cloudGoogleCalendarAccess("business-a"))
      .rejects.toMatchObject({ code: "reconnect_required" });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "reconnect_required",
      last_error: "Google Calendar needs to be reconnected.",
    });
  });

  it("requires reconnect when the integration no longer has a credential secret", async () => {
    const withoutCredential = { ...integration, credential_secret_id: null };
    const integrationQuery = query({ data: withoutCredential, error: null });
    mocks.from.mockReturnValue(integrationQuery);

    await expect(cloudGoogleCalendarAccess("business-a"))
      .rejects.toMatchObject({ code: "reconnect_required" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("read_google_calendar_credentials", expect.anything());
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "reconnect_required",
      last_error: "Google Calendar needs to be reconnected.",
    });
  });

  it("logs only sanitized classification metadata for unexpected refresh failures", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: {
        access_token: "expired-access-secret",
        refresh_token: "refresh-token-secret",
        expires_at: "2020-01-01T00:00:00.000Z",
      },
      error: null,
    });
    mocks.refresh.mockRejectedValue(new Error("refresh-token-secret provider-private-detail"));

    await expect(cloudGoogleCalendarAccess("business-a"))
      .rejects.toMatchObject({ code: "connection_retryable" });
    const serializedLogs = JSON.stringify(mocks.logCloudFailure.mock.calls);
    expect(serializedLogs).toContain("unknown_retryable");
    expect(serializedLogs).toContain("token_refresh");
    expect(serializedLogs).not.toContain("refresh-token-secret");
    expect(serializedLogs).not.toContain("expired-access-secret");
    expect(serializedLogs).not.toContain("provider-private-detail");
  });

  it("clears a prior connection-only retryable error after a successful status retry", async () => {
    const retryable = {
      ...integration,
      status: "error",
      destination_id: "owner@example.com",
      last_error: "Google Calendar could not be reached. Try again.",
    };
    const integrationQuery = query({ data: retryable, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: {
        access_token: "valid-access",
        refresh_token: "refresh-secret",
        expires_at: "2099-01-01T00:00:00.000Z",
      },
      error: null,
    });

    await expect(getCloudGoogleCalendarStatus("business-a")).resolves.toMatchObject({
      status: "connected",
      lastError: null,
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(integrationQuery.update).toHaveBeenCalledWith({
      status: "connected",
      last_error: null,
    });
  });

  it("preserves a partial-sync error until a later reconciliation succeeds", async () => {
    const partialFailure = {
      ...integration,
      status: "error",
      destination_id: "owner@example.com",
      last_error: "Some schedules could not be synced.",
    };
    const integrationQuery = query({ data: partialFailure, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: {
        access_token: "valid",
        refresh_token: "refresh",
        expires_at: "2099-01-01T00:00:00.000Z",
      },
      error: null,
    });

    await expect(getCloudGoogleCalendarStatus("business-a")).resolves.toMatchObject({
      status: "error",
      lastError: "Some schedules could not be synced.",
    });
    expect(integrationQuery.update).not.toHaveBeenCalled();
  });

  it("validates and persists only a writable destination calendar", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockResolvedValue({
      data: { access_token: "valid", refresh_token: "refresh", expires_at: "2099-01-01T00:00:00.000Z" },
      error: null,
    });
    mocks.googleApi.mockResolvedValue({
      items: [
        { id: "readonly", summary: "Read only", accessRole: "reader" },
        { id: "writable", summary: "Writable", accessRole: "writer" },
      ],
    });

    await selectCloudGoogleCalendar("business-a", "writable");
    expect(integrationQuery.update).toHaveBeenCalledWith({
      destination_id: "writable",
      status: "connected",
      last_error: null,
    });
    await expect(selectCloudGoogleCalendar("business-a", "readonly"))
      .rejects.toMatchObject({ code: "calendar_unavailable" });
  });

  it("revokes and removes only the Vault credential while preserving event mappings", async () => {
    const integrationQuery = query({ data: integration, error: null });
    mocks.from.mockReturnValue(integrationQuery);
    mocks.rpc.mockImplementation(async (name: string) => name === "read_google_calendar_credentials"
      ? { data: { access_token: "access", refresh_token: "refresh" }, error: null }
      : { data: true, error: null });

    await expect(disconnectCloudGoogleCalendar("business-a")).resolves.toEqual({ revoked: true });
    expect(mocks.revoke).toHaveBeenCalledWith("refresh");
    expect(mocks.rpc).toHaveBeenCalledWith("delete_google_calendar_credentials", {
      target_business_id: "business-a",
      target_integration_id: "integration-a",
    });
    expect(mocks.from).not.toHaveBeenCalledWith("calendar_event_links");
  });
});
