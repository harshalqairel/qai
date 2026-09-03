import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultQaiPage, type QaiPageConfig } from "@/features/qai-page/validation";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  logCloudFailure: vi.fn(),
  requireCloudBusinessContext: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createCloudAdminClient: () => ({ from: mocks.from }),
  logCloudFailure: mocks.logCloudFailure,
}));

vi.mock("@/lib/supabase/cloudContext", () => ({
  requireCloudBusinessContext: mocks.requireCloudBusinessContext,
}));

vi.mock("@/features/notifications/webPushServer", () => ({
  sendCloudBusinessPush: vi.fn(),
}));

import { GET, POST } from "./route";

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function publishedPage(): QaiPageConfig {
  const page = defaultQaiPage();
  return {
    ...page,
    id: "page-id",
    businessId: "business-id",
    slug: "testtt",
    businessName: "Test business",
    services: [{
      serviceId: "service-id",
      visible: true,
      title: "Published service",
      titleSource: "Service",
      description: "Published description",
      price: 25_000,
      priceSource: "Service",
      priceMode: "Fixed price",
      actionMode: "Booking request",
      durationMinutes: 60,
      defaultSessionCount: 1,
      locationPolicy: "Client can choose",
      optionGroups: [],
      variants: [],
      position: 0,
      featured: false,
    }],
  };
}

function ownerRequest(scope = "owner") {
  return new NextRequest(`https://qai.example/api/qai-space?scope=${scope}`);
}

function post(body: unknown) {
  return new NextRequest("https://qai.example/api/qai-space", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const operationalService = {
  id: "service-id",
  name: "Live service",
  category_id: "category-id",
  price: 50_000,
  duration_minutes: 90,
  default_session_count: 1,
  location_policy: "Client can choose",
  option_groups: [],
  variants: [],
  availability: null,
  description: "Live description",
  active: true,
};

function request() {
  return new NextRequest("https://qai.example/api/qai-space?scope=page&slug=testtt");
}

describe("public Qai Space page GET", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.logCloudFailure.mockReset();
    mocks.requireCloudBusinessContext.mockReset();
  });

  it("reads a published page by slug and materializes operational Services without owner auth", async () => {
    mocks.from.mockImplementation((table: string) => table === "qai_space_pages"
      ? query({ data: { id: "page-id", business_id: "business-id", payload: publishedPage() }, error: null })
      : query({ data: [operationalService], error: null }));

    const response = await GET(request());
    const body = await response.json() as { data: QaiPageConfig };

    expect(response.status).toBe(200);
    expect(body.data.services).toMatchObject([{
      serviceId: "service-id",
      title: "Live service",
      price: 50_000,
      durationMinutes: 90,
      visible: true,
    }]);
    expect(body.data.businessId).toBe("public");
    expect(mocks.requireCloudBusinessContext).not.toHaveBeenCalled();
  });

  it("does not expose private reservation identifiers in the public page payload", async () => {
    const page = {
      ...publishedPage(),
      slots: [{
        id: "slot-id",
        serviceId: "service-id",
        startAt: "2026-09-02T03:00:00.000Z",
        endAt: "2026-09-02T04:00:00.000Z",
        location: "Studio",
        status: "Reserved" as const,
        requestId: "private-request-id",
      }],
    };
    mocks.from.mockImplementation((table: string) => table === "qai_space_pages"
      ? query({ data: { id: "page-id", business_id: "business-id", payload: page }, error: null })
      : query({ data: [operationalService], error: null }));

    const response = await GET(request());
    const body = await response.json() as { data: QaiPageConfig };

    expect(response.status).toBe(200);
    expect(body.data.businessId).toBe("public");
    expect(body.data.slots[0]).toMatchObject({ id: "slot-id", status: "Reserved", requestId: null });
    expect(JSON.stringify(body)).not.toContain("private-request-id");
  });

  it("returns public presentation URLs instead of private owner media URLs", async () => {
    const mediaId = "09e711d6-9af7-4eb9-900c-f77799ffe262";
    const page = {
      ...publishedPage(),
      logo: `/api/qai-space/media/${mediaId}`,
      coverImage: "/api/qai-space/media/6f7bdd95-a3d6-4a9f-b27b-f6e4de71af3f",
      portfolio: [{
        id: "portfolio-item",
        imageUrl: "/api/qai-space/media/15523cec-7ca2-4fc4-b7a7-a37ae6e02c7c",
        caption: "Published work",
        serviceId: null,
        visible: true,
        position: 0,
      }],
    };
    mocks.from.mockImplementation((table: string) => table === "qai_space_pages"
      ? query({ data: { id: "page-id", business_id: "business-id", payload: page }, error: null })
      : query({ data: [operationalService], error: null }));

    const response = await GET(request());
    const body = await response.json() as { data: QaiPageConfig };
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.data.logo).toBe(`/api/qai-space/public-media/${mediaId}`);
    expect(body.data.coverImage).toBe("/api/qai-space/public-media/6f7bdd95-a3d6-4a9f-b27b-f6e4de71af3f");
    expect(body.data.portfolio[0].imageUrl).toBe("/api/qai-space/public-media/15523cec-7ca2-4fc4-b7a7-a37ae6e02c7c");
    expect(serialized).not.toContain("/api/qai-space/media/");
    expect(serialized).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "not-configured");
  });

  it("does not hide an operational Service permission defect behind the published snapshot", async () => {
    mocks.from.mockImplementation((table: string) => table === "qai_space_pages"
      ? query({ data: { id: "page-id", business_id: "business-id", payload: publishedPage() }, error: null })
      : query({ data: null, error: { code: "42501", message: "permission denied for table services" } }));

    const response = await GET(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Qai Space data could not be loaded." });
    expect(mocks.logCloudFailure).toHaveBeenCalledWith(
      "GET page",
      expect.objectContaining({ code: "42501", stage: "operational services" }),
    );
  });

  it("loads Booking and BookingSession capacity documents for public availability without owner auth", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "qai_space_pages") return query({ data: { id: "page-id", business_id: "business-id", payload: publishedPage() }, error: null });
      if (table === "services") return query({ data: [operationalService], error: null });
      return query({ data: [], error: null });
    });

    const response = await GET(new NextRequest(
      "https://qai.example/api/qai-space?scope=availability&slug=testtt&serviceId=service-id&date=2026-08-31",
    ));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [] });
    expect(mocks.from).toHaveBeenCalledWith("qai_space_requests");
    expect(mocks.from).toHaveBeenCalledWith("bookings");
    expect(mocks.from).toHaveBeenCalledWith("booking_sessions");
    expect(mocks.requireCloudBusinessContext).not.toHaveBeenCalled();
  });

  it("reports the exact capacity stage instead of hiding a Booking read permission error", async () => {
    mocks.from.mockImplementation((table: string) => {
      if (table === "qai_space_pages") return query({ data: { id: "page-id", business_id: "business-id", payload: publishedPage() }, error: null });
      if (table === "services") return query({ data: [operationalService], error: null });
      if (table === "bookings") return query({ data: null, error: { code: "42501", message: "permission denied for table bookings" } });
      return query({ data: [], error: null });
    });

    const response = await GET(new NextRequest(
      "https://qai.example/api/qai-space?scope=availability&slug=testtt&serviceId=service-id&date=2026-08-31",
    ));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Qai Space data could not be loaded." });
    expect(mocks.logCloudFailure).toHaveBeenCalledWith(
      "GET availability",
      expect.objectContaining({ code: "42501", stage: "capacity bookings" }),
    );
  });

  it("returns a controlled public error and logs the payload-validation stage for malformed stored data", async () => {
    mocks.from.mockImplementation(() => query({
      data: { id: "page-id", business_id: "business-id", payload: { slug: "testtt" } },
      error: null,
    }));

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Qai Space data could not be loaded." });
    expect(mocks.logCloudFailure).toHaveBeenCalledWith(
      "GET page",
      expect.objectContaining({ stage: "payload validation" }),
    );
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});

describe("owner Qai Space API", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.logCloudFailure.mockReset();
    mocks.requireCloudBusinessContext.mockReset();
  });

  it("loads only the authenticated owner's workspace and preserves the stored template", async () => {
    const ownerFrom = vi.fn((table: string) => {
      if (table === "qai_space_pages") return query({ data: { id: "page-id", payload: { ...publishedPage(), businessId: "business-a", template: "Editorial" } }, error: null });
      if (table === "qai_space_requests") return query({ data: [], error: null });
      return query({ data: [operationalService], error: null });
    });
    mocks.requireCloudBusinessContext.mockResolvedValue({
      client: { from: ownerFrom },
      businessId: "business-a",
      businessName: "Business A",
      timezone: "Asia/Jakarta",
    });

    const response = await GET(new NextRequest("https://qai.example/api/qai-space?scope=owner&businessId=business-b"));
    const body = await response.json() as { data: { pages: QaiPageConfig[] } };

    expect(response.status).toBe(200);
    expect(body.data.pages[0]).toMatchObject({ businessId: "business-a", template: "Editorial" });
    const pageQuery = ownerFrom.mock.results[0].value as { eq: ReturnType<typeof vi.fn> };
    expect(pageQuery.eq).toHaveBeenCalledWith("business_id", "business-a");
    expect(pageQuery.eq).not.toHaveBeenCalledWith("business_id", "business-b");
  });

  it("forces the authenticated workspace on save and returns the persisted template", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const pageTable = {
      select: vi.fn(() => pageTable),
      eq: vi.fn(() => pageTable),
      maybeSingle: vi.fn(async () => ({ data: { id: "existing-page-id" }, error: null })),
      upsert,
    };
    const ownerFrom = vi.fn(() => pageTable);
    mocks.requireCloudBusinessContext.mockResolvedValue({
      client: { from: ownerFrom },
      businessId: "business-a",
      businessName: "Business A",
      timezone: "Asia/Jakarta",
    });
    const forged = { ...publishedPage(), businessId: "business-b", template: "Editorial" as const };

    const response = await POST(post({ action: "save-page", page: forged }));
    const body = await response.json() as { data: QaiPageConfig };

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({ id: "existing-page-id", businessId: "business-a", template: "Editorial" });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      id: "existing-page-id",
      business_id: "business-a",
      payload: expect.objectContaining({ businessId: "business-a", template: "Editorial" }),
    }), { onConflict: "business_id" });
  });

  it("requires owner authentication for owner reads and saves", async () => {
    mocks.requireCloudBusinessContext.mockRejectedValue(new Error("AUTH_REQUIRED"));

    const loadResponse = await GET(ownerRequest());
    const saveResponse = await POST(post({ action: "save-page", page: publishedPage() }));

    expect(loadResponse.status).toBe(401);
    expect(saveResponse.status).toBe(401);
    await expect(loadResponse.json()).resolves.toEqual({ error: "Sign in to manage this Qai Space." });
    await expect(saveResponse.json()).resolves.toEqual({ error: "The Qai Space change could not be completed." });
  });
});
