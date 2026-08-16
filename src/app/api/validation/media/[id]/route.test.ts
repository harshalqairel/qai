import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createValidationAdminClient: vi.fn(),
  requireValidationSession: vi.fn(),
}));

vi.mock("@/lib/validation/admin", () => ({ createValidationAdminClient: mocks.createValidationAdminClient }));
vi.mock("@/lib/validation/session", () => ({ requireValidationSession: mocks.requireValidationSession }));

import { GET } from "./route";

function adminClient() {
  const asset = { workspace_id: "workspace-a", kind: "booking-response", storage_path: "workspace-a/booking-response/file.png", mime_type: "image/png" };
  const maybeSingle = vi.fn().mockResolvedValue({ data: asset });
  const download = vi.fn().mockResolvedValue({ data: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }), error: null });
  return {
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) })),
    storage: { from: vi.fn(() => ({ download })) },
    download,
  };
}

function context() { return { params: Promise.resolve({ id: "10000000-0000-4000-8000-000000000001" }) }; }

beforeEach(() => { vi.clearAllMocks(); });

describe("private questionnaire media reads", () => {
  it("does not expose a private answer file to an anonymous client", async () => {
    const admin = adminClient();
    mocks.createValidationAdminClient.mockReturnValue(admin);
    mocks.requireValidationSession.mockRejectedValue(new Error("No session"));

    const response = await GET(new Request("https://qai.example/api/validation/media/file"), context());

    expect(response.status).toBe(404);
    expect(admin.download).not.toHaveBeenCalled();
  });

  it("does not expose a private answer file to another workspace", async () => {
    const admin = adminClient();
    mocks.createValidationAdminClient.mockReturnValue(admin);
    mocks.requireValidationSession.mockResolvedValue({ workspaceId: "workspace-b" });

    const response = await GET(new Request("https://qai.example/api/validation/media/file"), context());

    expect(response.status).toBe(404);
    expect(admin.download).not.toHaveBeenCalled();
  });

  it("preserves private file access for the owning workspace", async () => {
    const admin = adminClient();
    mocks.createValidationAdminClient.mockReturnValue(admin);
    mocks.requireValidationSession.mockResolvedValue({ workspaceId: "workspace-a" });

    const response = await GET(new Request("https://qai.example/api/validation/media/file"), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(admin.download).toHaveBeenCalledWith("workspace-a/booking-response/file.png");
  });
});
