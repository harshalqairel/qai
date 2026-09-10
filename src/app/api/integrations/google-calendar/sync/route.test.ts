import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  sync: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isCloudModeEnabled: () => true }));
vi.mock("@/lib/supabase/cloudContext", () => ({ requireCloudBusinessAdminContext: mocks.context }));
vi.mock("@/lib/google-calendar/cloudConnection", () => ({
  CloudCalendarError: class CloudCalendarError extends Error {
    constructor(readonly code: string, message: string, readonly status = 400) { super(message); }
  },
}));
vi.mock("@/lib/google-calendar/cloudSync", () => ({
  synchronizeCloudGoogleCalendar: mocks.sync,
  isPartialCalendarSync: (summary: { failed: number }) => summary.failed > 0,
}));

import { POST } from "./route";

function request(body?: unknown) {
  return new NextRequest("https://qai.example/api/integrations/google-calendar/sync", {
    method: "POST",
    ...(body === undefined ? {} : {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
}

const complete = {
  created: 1,
  updated: 1,
  deleted: 0,
  unchanged: 2,
  skipped: 0,
  failed: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    client: { marker: "authenticated-client" },
    businessId: "business-a",
    userId: "user-a",
    timezone: "Asia/Jakarta",
  });
  mocks.sync.mockResolvedValue(complete);
});

describe("cloud Google Calendar sync route", () => {
  it("binds the sync to the authenticated business and selected Sessions", async () => {
    const response = await POST(request({ scheduleIds: [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ] }));
    expect(response.status).toBe(200);
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({
      client: { marker: "authenticated-client" },
      businessId: "business-a",
      timezone: "Asia/Jakarta",
      requestedSessionIds: new Set([
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ]),
    }));
  });

  it("returns a non-success response for a partial reconciliation", async () => {
    mocks.sync.mockResolvedValue({ ...complete, failed: 1 });
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      error: "Some schedules could not be synced.",
      data: { created: 1, failed: 1 },
    });
  });

  it("does not accept a caller-supplied business identity", async () => {
    await POST(request({
      scheduleIds: ["00000000-0000-4000-8000-000000000001"],
      businessId: "business-b",
    }));
    expect(mocks.sync).toHaveBeenCalledWith(expect.objectContaining({ businessId: "business-a" }));
    expect(mocks.sync).not.toHaveBeenCalledWith(expect.objectContaining({ businessId: "business-b" }));
  });

  it("rejects unauthenticated cloud sync", async () => {
    mocks.context.mockRejectedValue(new Error("AUTH_REQUIRED"));
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.sync).not.toHaveBeenCalled();
  });

  it("rejects a non-admin workspace member before service-role sync", async () => {
    mocks.context.mockRejectedValue(new Error("BUSINESS_ADMIN_REQUIRED"));
    const response = await POST(request());
    expect(response.status).toBe(403);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
