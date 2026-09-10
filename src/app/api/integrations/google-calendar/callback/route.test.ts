import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), complete: vi.fn() }));

vi.mock("@/lib/supabase/config", () => ({ isCloudModeEnabled: () => true }));
vi.mock("@/lib/supabase/cloudContext", () => ({ requireCloudBusinessAdminContext: mocks.context }));
vi.mock("@/lib/google-calendar/cloudConnection", () => ({
  CloudCalendarError: class CloudCalendarError extends Error {
    constructor(readonly code: string, message: string, readonly status = 400) { super(message); }
  },
  completeCloudGoogleCalendarOAuth: mocks.complete,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ businessId: "business-a", userId: "user-a" });
  mocks.complete.mockResolvedValue(undefined);
});

describe("cloud Google Calendar callback", () => {
  it("treats OAuth denial as a cancellation without consuming state", async () => {
    const response = await GET(new NextRequest(
      "https://qai.example/api/integrations/google-calendar/callback?error=access_denied&state=state",
    ));
    expect(response.headers.get("location")).toBe(
      "https://qai.example/settings?section=integrations&calendar=cancelled",
    );
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("binds code completion to the authenticated business and user", async () => {
    const response = await GET(new NextRequest(
      "https://qai.example/api/integrations/google-calendar/callback?code=code&state=state",
    ));
    expect(mocks.complete).toHaveBeenCalledWith({
      businessId: "business-a",
      userId: "user-a",
      code: "code",
      state: "state",
    });
    expect(response.headers.get("location")).toBe(
      "https://qai.example/settings?section=integrations&calendar=connected",
    );
  });

  it("preserves mappings by surfacing an account mismatch instead of replacing credentials", async () => {
    const { CloudCalendarError } = await import("@/lib/google-calendar/cloudConnection");
    mocks.complete.mockRejectedValue(new CloudCalendarError("account_mismatch", "same account", 409));
    const response = await GET(new NextRequest(
      "https://qai.example/api/integrations/google-calendar/callback?code=code&state=state",
    ));
    expect(response.headers.get("location")).toBe(
      "https://qai.example/settings?section=integrations&calendar=account-mismatch",
    );
  });
});
