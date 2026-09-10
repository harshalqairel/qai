import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  status: vi.fn(),
  select: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isCloudModeEnabled: () => true }));
vi.mock("@/lib/supabase/cloudContext", () => ({ requireCloudBusinessAdminContext: mocks.context }));
vi.mock("@/lib/google-calendar/cloudConnection", () => ({
  CloudCalendarError: class CloudCalendarError extends Error {
    constructor(readonly code: string, message: string, readonly status = 400) { super(message); }
  },
  getCloudGoogleCalendarStatus: mocks.status,
  selectCloudGoogleCalendar: mocks.select,
  disconnectCloudGoogleCalendar: mocks.disconnect,
}));

import { DELETE, GET, PATCH } from "./route";

const status = {
  configured: true,
  status: "connected",
  googleAccount: "owner@example.com",
  targetCalendarId: "primary",
  lastSyncAt: null,
  lastSyncAttemptAt: null,
  lastError: null,
  calendars: [{ id: "primary", name: "Primary", primary: true }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ businessId: "business-a", userId: "user-a" });
  mocks.status.mockResolvedValue(status);
  mocks.select.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue({ revoked: true });
});

describe("cloud Google Calendar settings route", () => {
  it("returns presentation state without Vault credentials", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data).toEqual(status);
    expect(JSON.stringify(body)).not.toMatch(/access_token|refresh_token|credential_secret_id/i);
  });

  it("persists calendar selection only for the authenticated business", async () => {
    const response = await PATCH(new Request("https://qai.example/api/integrations/google-calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId: "studio", businessId: "business-b" }),
    }));
    expect(response.status).toBe(200);
    expect(mocks.select).toHaveBeenCalledWith("business-a", "studio");
    expect(mocks.select).not.toHaveBeenCalledWith("business-b", "studio");
  });

  it("disconnects credentials without accepting a caller-selected integration", async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(mocks.disconnect).toHaveBeenCalledWith("business-a");
  });

  it("blocks non-admin members before any service-role operation", async () => {
    mocks.context.mockRejectedValue(new Error("BUSINESS_ADMIN_REQUIRED"));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(mocks.status).not.toHaveBeenCalled();
  });
});
