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

import { GET } from "./route";

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
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
    expect(mocks.requireCloudBusinessContext).not.toHaveBeenCalled();
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
