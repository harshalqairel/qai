import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { privateQaiSpaceMediaUrl } from "@/features/qai-page/cloudMedia";
import { defaultQaiPage, type QaiPageConfig } from "@/features/qai-page/validation";

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  from: vi.fn(),
  requireCloudBusinessContext: vi.fn(),
  storageFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createCloudAdminClient: () => ({
    from: mocks.from,
    storage: { from: mocks.storageFrom },
  }),
}));

vi.mock("@/lib/supabase/cloudContext", () => ({
  requireCloudBusinessContext: mocks.requireCloudBusinessContext,
}));

import { GET as getPrivateMedia } from "./media/[id]/route";
import { GET as getPublicMedia } from "./public-media/[id]/route";

const MEDIA_ID = "09e711d6-9af7-4eb9-900c-f77799ffe262";
const OTHER_ID = "6f7bdd95-a3d6-4a9f-b27b-f6e4de71af3f";

type QueryResult = { data: unknown; error: unknown };

function query(result: QueryResult) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.not = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

function context(id = MEDIA_ID) {
  return { params: Promise.resolve({ id }) };
}

function mediaAsset(businessId = "business-a", kind = "portfolio") {
  return {
    id: MEDIA_ID,
    business_id: businessId,
    kind,
    storage_path: `${businessId}/${kind}/${MEDIA_ID}.png`,
    mime_type: "image/png",
  };
}

function pageWithPortfolio(visible = true): QaiPageConfig {
  const page = defaultQaiPage();
  page.businessId = "business-a";
  page.portfolio = [{
    id: "portfolio-item",
    imageUrl: privateQaiSpaceMediaUrl(MEDIA_ID),
    caption: "Controlled media",
    serviceId: null,
    visible,
    position: 0,
  }];
  return page;
}

function configureQueries(page: QaiPageConfig | null, asset: ReturnType<typeof mediaAsset> | null = mediaAsset()) {
  const mediaQuery = query({ data: asset, error: null });
  const pageQuery = query({ data: page ? { payload: page } : null, error: null });
  mocks.from.mockImplementation((table: string) => table === "qai_space_media_assets" ? mediaQuery : pageQuery);
  return { mediaQuery, pageQuery };
}

describe("Qai Space media delivery boundaries", () => {
  beforeEach(() => {
    mocks.download.mockReset().mockResolvedValue({ data: new Blob(["controlled-image"], { type: "image/png" }), error: null });
    mocks.from.mockReset();
    mocks.requireCloudBusinessContext.mockReset();
    mocks.storageFrom.mockReset().mockReturnValue({ download: mocks.download });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets an authenticated owner read their own private media without public caching", async () => {
    mocks.requireCloudBusinessContext.mockResolvedValue({ businessId: "business-a" });
    const { mediaQuery } = configureQueries(null);

    const response = await getPrivateMedia(new Request(`https://qai.example/api/qai-space/media/${MEDIA_ID}`), context());

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cache-control")).not.toMatch(/(^|,\s*)public\b/);
    expect(response.headers.get("vary")).toContain("Cookie");
    expect((mediaQuery.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("business_id", "business-a");
  });

  it("does not let another workspace read private media", async () => {
    mocks.requireCloudBusinessContext.mockResolvedValue({ businessId: "business-b" });
    const { mediaQuery } = configureQueries(null, null);

    const response = await getPrivateMedia(new Request(`https://qai.example/api/qai-space/media/${MEDIA_ID}`), context());

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((mediaQuery.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("business_id", "business-b");
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("keeps owner-first unpublished media inaccessible through the anonymous public boundary", async () => {
    mocks.requireCloudBusinessContext.mockResolvedValue({ businessId: "business-a" });
    configureQueries(defaultQaiPage());

    const ownerResponse = await getPrivateMedia(new Request(`https://qai.example/api/qai-space/media/${MEDIA_ID}`), context());
    const publicResponse = await getPublicMedia(new Request(`https://qai.example/api/qai-space/public-media/${MEDIA_ID}`), context());

    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.headers.get("cache-control")).toContain("no-store");
    expect(publicResponse.status).toBe(404);
    expect(publicResponse.headers.get("cache-control")).toContain("no-store");
    expect(mocks.download).toHaveBeenCalledTimes(1);
  });

  it("serves an intentionally published image only through the public no-store route", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-secret");
    configureQueries(pageWithPortfolio());

    const response = await getPublicMedia(new Request(`https://qai.example/api/qai-space/public-media/${MEDIA_ID}`), context());
    const bytes = new TextDecoder().decode(await response.arrayBuffer());
    const serializedHeaders = JSON.stringify(Object.fromEntries(response.headers));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("cache-control")).not.toMatch(/(^|,\s*)public\b/);
    expect(bytes).toBe("controlled-image");
    expect(`${serializedHeaders}${bytes}`).not.toContain("storage_path");
    expect(`${serializedHeaders}${bytes}`).not.toContain("server-only-secret");
    expect(mocks.requireCloudBusinessContext).not.toHaveBeenCalled();
  });

  it("revokes direct public access after a published image is hidden or removed", async () => {
    configureQueries(pageWithPortfolio(false));
    const hidden = await getPublicMedia(new Request(`https://qai.example/api/qai-space/public-media/${MEDIA_ID}`), context());
    expect(hidden.status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();

    configureQueries(defaultQaiPage());
    const removed = await getPublicMedia(new Request(`https://qai.example/api/qai-space/public-media/${MEDIA_ID}`), context());
    expect(removed.status).toBe(404);
    expect(removed.headers.get("cache-control")).toContain("no-store");
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("derives publication scope from the asset and ignores forged workspace input", async () => {
    const { pageQuery } = configureQueries(defaultQaiPage());

    const response = await getPublicMedia(
      new Request(`https://qai.example/api/qai-space/public-media/${MEDIA_ID}?businessId=business-b`),
      context(),
    );

    expect(response.status).toBe(404);
    expect((pageQuery.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith("business_id", "business-a");
  });

  it("rejects arbitrary media IDs and non-public questionnaire assets", async () => {
    configureQueries(null, null);
    const arbitrary = await getPublicMedia(new Request(`https://qai.example/api/qai-space/public-media/${OTHER_ID}`), context(OTHER_ID));
    expect(arbitrary.status).toBe(404);

    configureQueries(pageWithPortfolio(), mediaAsset("business-a", "booking-response"));
    const privateResponse = await getPublicMedia(new Request(`https://qai.example/api/qai-space/public-media/${MEDIA_ID}`), context());
    expect(privateResponse.status).toBe(404);
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
