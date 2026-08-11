import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireValidationAdmin: vi.fn(),
  createValidationAdminClient: vi.fn(),
  logValidationAdminFailure: vi.fn(),
}));

vi.mock("@/lib/validation/session", () => ({
  hashValidationSecret: vi.fn(),
  requireValidationAdmin: mocks.requireValidationAdmin,
}));

vi.mock("@/lib/validation/admin", () => ({
  createValidationAdminClient: mocks.createValidationAdminClient,
  logValidationAdminFailure: mocks.logValidationAdminFailure,
}));

vi.mock("@/lib/validation/tokens", () => ({
  createValidationCode: vi.fn(),
  randomValidationToken: vi.fn(),
  validationSlug: vi.fn(),
}));

import { GET, POST } from "./route";

function adminClient(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  return { from: vi.fn(() => ({ select: vi.fn(() => ({ order })) })) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireValidationAdmin.mockResolvedValue(undefined);
});

describe("founder workspace GET error semantics", () => {
  it("returns 200 for a valid founder and successful workspace query", async () => {
    const data = [{ id: "workspace-1", label: "Ardi Photography" }];
    mocks.createValidationAdminClient.mockReturnValue(adminClient({ data, error: null }));

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data });
    expect(mocks.logValidationAdminFailure).not.toHaveBeenCalled();
  });

  it("returns 401 only when founder authentication fails", async () => {
    mocks.requireValidationAdmin.mockRejectedValue(new Error("Invalid founder session"));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Founder access is required." });
    expect(mocks.createValidationAdminClient).not.toHaveBeenCalled();
    expect(mocks.logValidationAdminFailure).not.toHaveBeenCalled();
  });

  it("returns a generic 500 and logs diagnostics when the query fails", async () => {
    const databaseError = { message: "raw sensitive database detail", code: "PGRST205", details: "private schema detail", hint: "private hint" };
    mocks.createValidationAdminClient.mockReturnValue(adminClient({ data: null, error: databaseError }));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Could not load tester workspaces." });
    expect(JSON.stringify(body)).not.toContain(databaseError.message);
    expect(JSON.stringify(body)).not.toContain(databaseError.details);
    expect(mocks.logValidationAdminFailure).toHaveBeenCalledWith("founder workspace load", databaseError);
  });
});

describe("founder workspace POST error semantics", () => {
  function request(body: unknown) {
    return new Request("https://qai.example/api/validation/admin/workspaces", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  }

  it("returns 401 when founder authentication fails", async () => {
    mocks.requireValidationAdmin.mockRejectedValue(new Error("Invalid founder session"));

    const response = await POST(request({ label: "Ardi Photography" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Founder access is required." });
    expect(mocks.createValidationAdminClient).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input", async () => {
    const response = await POST(request({ label: "" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Enter a valid tester or business name." });
    expect(mocks.createValidationAdminClient).not.toHaveBeenCalled();
  });

  it("returns a generic 500 for configuration or database failures", async () => {
    const serverError = new Error("raw configuration failure");
    mocks.createValidationAdminClient.mockImplementation(() => { throw serverError; });

    const response = await POST(request({ label: "Ardi Photography" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "Could not create that tester workspace." });
    expect(JSON.stringify(body)).not.toContain(serverError.message);
    expect(mocks.logValidationAdminFailure).toHaveBeenCalledWith("founder workspace create", serverError);
  });
});
