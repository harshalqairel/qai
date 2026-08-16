import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultQaiPage } from "@/features/qai-page/validation";

const mocks = vi.hoisted(() => ({ createValidationAdminClient: vi.fn() }));

vi.mock("@/lib/validation/admin", () => ({ createValidationAdminClient: mocks.createValidationAdminClient }));

import { POST } from "./route";

function pagePayload() {
  const now = Date.now();
  return {
    ...defaultQaiPage(),
    slug: "public-studio",
    services: [{ serviceId: "service-a", visible: true, title: "Studio session", description: "", price: 100_000, priceMode: "Fixed price" as const, actionMode: "Booking request" as const, durationMinutes: 60, defaultSessionCount: 1, locationPolicy: "Client can choose" as const }],
    questionnaire: {
      businessId: "local-business",
      introduction: "",
      closing: "",
      enabledCoreFields: ["name", "phone", "service", "date"] as const,
      questions: [{ id: "reference-file", label: "Reference file", helperText: "", type: "File / image" as const, required: false, options: [], active: true, order: 1, serviceIds: ["service-a"], createdAt: now, updatedAt: now }],
      updatedAt: now,
    },
    updatedAt: now,
  };
}

function uploadRequest(slug = "public-studio") {
  const form = new FormData();
  form.set("file", new File([new Uint8Array([137, 80, 78, 71])], "reference.png", { type: "image/png" }));
  form.set("slug", slug);
  form.set("serviceId", "service-a");
  form.set("questionId", "reference-file");
  return new Request("https://qai.example/api/validation/public-media", { method: "POST", body: form });
}

function adminClient(page: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: page ? { workspace_id: "workspace-a", payload: page } : null });
  const insert = vi.fn().mockResolvedValue({ error: null });
  const upload = vi.fn().mockResolvedValue({ error: null });
  return {
    from: vi.fn((table: string) => table === "validation_public_pages"
      ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }
      : { insert }),
    storage: { from: vi.fn(() => ({ upload, remove: vi.fn() })) },
    spies: { insert, upload },
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe("public questionnaire media upload", () => {
  it("accepts a supported file only after resolving a valid public page, service, and question", async () => {
    const admin = adminClient(pagePayload());
    mocks.createValidationAdminClient.mockReturnValue(admin);

    const response = await POST(uploadRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.url).toMatch(/^\/api\/validation\/media\/[0-9a-f-]{36}$/);
    expect(admin.spies.upload).toHaveBeenCalledOnce();
    expect(admin.spies.insert).toHaveBeenCalledWith(expect.objectContaining({ workspace_id: "workspace-a", kind: "booking-response", mime_type: "image/png" }));
  });

  it("rejects an upload when the public page context cannot be resolved", async () => {
    const admin = adminClient(null);
    mocks.createValidationAdminClient.mockReturnValue(admin);

    const response = await POST(uploadRequest("missing-page"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "This Qai Page is not available." });
    expect(admin.spies.upload).not.toHaveBeenCalled();
  });
});
