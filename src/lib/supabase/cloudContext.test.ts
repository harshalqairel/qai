import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser }, from: mocks.from }),
}));

import { requireCloudBusinessAdminContext, requireCloudBusinessContext } from "./cloudContext";

function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
});

describe("cloud business integration authorization", () => {
  it("returns the persisted owner/admin role with the business context", async () => {
    mocks.from.mockImplementation((table: string) => table === "business_memberships"
      ? query({ data: { business_id: "business-a", role: "admin" }, error: null })
      : query({ data: { id: "business-a", name: "Studio", timezone: "Asia/Jakarta" }, error: null }));

    await expect(requireCloudBusinessAdminContext()).resolves.toMatchObject({
      userId: "user-a",
      businessId: "business-a",
      membershipRole: "admin",
    });
  });

  it("allows ordinary member data context but rejects integration administration", async () => {
    mocks.from.mockImplementation((table: string) => table === "business_memberships"
      ? query({ data: { business_id: "business-a", role: "member" }, error: null })
      : query({ data: { id: "business-a", name: "Studio", timezone: "Asia/Jakarta" }, error: null }));

    await expect(requireCloudBusinessContext()).resolves.toMatchObject({ membershipRole: "member" });
    await expect(requireCloudBusinessAdminContext()).rejects.toThrow("BUSINESS_ADMIN_REQUIRED");
  });
});
