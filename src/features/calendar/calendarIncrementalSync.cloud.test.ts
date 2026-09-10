// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";

const flush = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/config", () => ({
  isCloudModeEnabled: () => true,
  isValidationModeEnabled: () => false,
}));
vi.mock("@/lib/validation/workspaceSync", () => ({ flushWorkspaceDocuments: flush }));

import { synchronizeAffectedCalendarSessions } from "./calendarIncrementalSync";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("cloud incremental Calendar sync", () => {
  it("sends stable unique Session IDs after cloud persistence without flushing validation documents", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { updated: 1 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await synchronizeAffectedCalendarSessions(["session-a", "session-a", "session-b"]);

    expect(flush).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("/api/integrations/google-calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleIds: ["session-a", "session-b"] }),
    });
  });

  it("does not retry when Calendar is intentionally disconnected", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "not_connected" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await synchronizeAffectedCalendarSessions(["session-a"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
