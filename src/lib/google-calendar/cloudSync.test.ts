import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIntegration: vi.fn(),
  access: vi.fn(),
  updateIntegration: vi.fn(),
  markReconnect: vi.fn(),
  googleApi: vi.fn(),
  reconcile: vi.fn(),
  adminFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createCloudAdminClient: () => ({ from: mocks.adminFrom }),
}));

vi.mock("./cloudConnection", () => ({
  CloudCalendarError: class CloudCalendarError extends Error {
    constructor(readonly code: string, message: string, readonly status = 400) { super(message); }
  },
  cloudGoogleCalendarAccess: mocks.access,
  getCloudCalendarIntegration: mocks.getIntegration,
  markCloudGoogleCalendarReconnectRequired: mocks.markReconnect,
  updateCloudCalendarIntegration: mocks.updateIntegration,
}));

vi.mock("./googleApi", () => ({
  googleCalendarApi: mocks.googleApi,
  GoogleCalendarApiError: class GoogleCalendarApiError extends Error {
    constructor(readonly status: number) { super("provider"); }
  },
}));

vi.mock("./reconciliation", () => ({
  reconcileGoogleCalendar: mocks.reconcile,
}));

import { synchronizeCloudGoogleCalendar } from "./cloudSync";

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
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
  last_sync_at: "2026-08-31T00:00:00.000Z",
  last_sync_attempt_at: null,
  last_error: null,
  updated_at: "2026-09-01T00:00:00.000Z",
};

function client() {
  const builders = new Map<string, ReturnType<typeof query>>();
  const from = vi.fn((table: string) => {
    const builder = query({ data: [], error: null });
    builders.set(table, builder);
    return builder;
  });
  return { client: { from }, from, builders };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIntegration.mockResolvedValue(integration);
  mocks.access.mockResolvedValue({ accessToken: "access", integration });
  mocks.updateIntegration.mockResolvedValue(undefined);
  mocks.googleApi.mockResolvedValue({
    items: [{ id: "primary", summary: "Primary", accessRole: "owner", primary: true }],
  });
  mocks.adminFrom.mockReturnValue(query({ data: [], error: null }));
  mocks.reconcile.mockResolvedValue({
    created: 1,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    skipped: 0,
    failed: 0,
  });
});
describe("cloud Calendar sync orchestration", () => {
  it("records an attempt before credential access and advances last_sync_at only after full success", async () => {
    const context = client();
    await synchronizeCloudGoogleCalendar({
      client: context.client as never,
      businessId: "business-a",
      timezone: "Asia/Jakarta",
    });

    expect(mocks.updateIntegration.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.access.mock.invocationCallOrder[0]!);
    expect(mocks.updateIntegration).toHaveBeenNthCalledWith(1, "business-a", "integration-a", {
      last_sync_attempt_at: expect.any(String),
    });
    expect(mocks.updateIntegration).toHaveBeenLastCalledWith("business-a", "integration-a", {
      status: "connected",
      last_sync_at: expect.any(String),
      last_error: null,
    });
    expect(context.from.mock.calls.map(([table]) => table).sort()).toEqual([
      "booking_sessions",
      "bookings",
      "customers",
      "services",
    ]);
    for (const builder of context.builders.values()) {
      expect(builder.eq).toHaveBeenCalledWith("business_id", "business-a");
    }
  });

  it("does not advance last_sync_at when any Session operation fails", async () => {
    const context = client();
    mocks.reconcile.mockResolvedValue({
      created: 2,
      updated: 0,
      deleted: 0,
      unchanged: 0,
      skipped: 0,
      failed: 1,
    });

    await expect(synchronizeCloudGoogleCalendar({
      client: context.client as never,
      businessId: "business-a",
      timezone: "Asia/Jakarta",
    })).resolves.toMatchObject({ failed: 1 });
    expect(mocks.updateIntegration).toHaveBeenNthCalledWith(1, "business-a", "integration-a", {
      last_sync_attempt_at: expect.any(String),
    });
    expect(mocks.updateIntegration).toHaveBeenLastCalledWith("business-a", "integration-a", {
      status: "error",
      last_error: "Some schedules could not be synced.",
    });
    expect(mocks.updateIntegration.mock.calls.flatMap((call) => Object.keys(call[2] ?? {})))
      .not.toContain("last_sync_at");
  });

  it("advances last_sync_at after a missing event is successfully recovered", async () => {
    const context = client();
    mocks.reconcile.mockResolvedValue({
      created: 1,
      updated: 0,
      deleted: 0,
      unchanged: 2,
      skipped: 0,
      failed: 0,
    });

    await expect(synchronizeCloudGoogleCalendar({
      client: context.client as never,
      businessId: "business-a",
      timezone: "Asia/Jakarta",
    })).resolves.toMatchObject({ created: 1, unchanged: 2, failed: 0 });
    expect(mocks.updateIntegration).toHaveBeenLastCalledWith("business-a", "integration-a", {
      status: "connected",
      last_sync_at: expect.any(String),
      last_error: null,
    });
  });

  it("still records last_sync_attempt_at when credential refresh requires reconnection", async () => {
    const context = client();
    mocks.access.mockRejectedValue(new Error("reconnect"));

    await expect(synchronizeCloudGoogleCalendar({
      client: context.client as never,
      businessId: "business-a",
      timezone: "Asia/Jakarta",
    })).rejects.toThrow("reconnect");
    expect(mocks.updateIntegration).toHaveBeenNthCalledWith(1, "business-a", "integration-a", {
      last_sync_attempt_at: expect.any(String),
    });
    expect(mocks.updateIntegration.mock.calls.flatMap((call) => Object.keys(call[2] ?? {})))
      .not.toContain("last_sync_at");
  });
});
