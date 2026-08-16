import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
  verifyValidationPayload: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({ isValidationModeEnabled: () => true }));
vi.mock("@/lib/supabase/proxy", () => ({ updateSession: mocks.updateSession }));
vi.mock("@/lib/validation/session", () => ({
  VALIDATION_ADMIN_COOKIE: "qai_validation_admin",
  VALIDATION_SESSION_COOKIE: "qai_validation_session",
  verifyValidationPayload: mocks.verifyValidationPayload,
}));

import { proxy } from "./proxy";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.verifyValidationPayload.mockResolvedValue(null);
});

describe("validation proxy media boundaries", () => {
  it("allows only the dedicated public questionnaire upload route without a workspace session", async () => {
    const response = await proxy(new NextRequest("https://qai.example/api/validation/public-media", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.verifyValidationPayload).not.toHaveBeenCalled();
  });

  it("continues to reject anonymous access to the owner media upload route", async () => {
    const response = await proxy(new NextRequest("https://qai.example/api/validation/media", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Validation access is required." });
  });

  it("continues to allow the owner media route for a valid workspace session", async () => {
    mocks.verifyValidationPayload.mockResolvedValue({ kind: "workspace", workspaceId: "workspace-a", sessionId: "session-a", expiresAt: Date.now() + 60_000 });
    const request = new NextRequest("https://qai.example/api/validation/media", { method: "POST" });
    request.cookies.set("qai_validation_session", "signed-session");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
