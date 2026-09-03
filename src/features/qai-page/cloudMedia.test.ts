import { describe, expect, it } from "vitest";

import {
  isPublishedQaiSpaceMedia,
  privateQaiSpaceMediaUrl,
  publicQaiSpaceMediaUrl,
  qaiSpaceMediaId,
  toPublicQaiSpaceMediaUrl,
  withPublicQaiSpaceMediaUrls,
} from "./cloudMedia";
import { defaultQaiPage } from "./validation";

const MEDIA_ID = "09e711d6-9af7-4eb9-900c-f77799ffe262";

describe("Qai Space media URL boundaries", () => {
  it("maps stored owner media URLs onto the distinct public delivery route", () => {
    const page = defaultQaiPage();
    page.logo = privateQaiSpaceMediaUrl(MEDIA_ID);
    page.coverImage = privateQaiSpaceMediaUrl("6f7bdd95-a3d6-4a9f-b27b-f6e4de71af3f");
    page.portfolio = [{
      id: "portfolio-item",
      imageUrl: privateQaiSpaceMediaUrl("15523cec-7ca2-4fc4-b7a7-a37ae6e02c7c"),
      caption: "Published work",
      serviceId: null,
      visible: true,
      position: 0,
    }];

    const result = withPublicQaiSpaceMediaUrls(page);

    expect(result.logo).toBe(publicQaiSpaceMediaUrl(MEDIA_ID));
    expect(result.coverImage).toBe("/api/qai-space/public-media/6f7bdd95-a3d6-4a9f-b27b-f6e4de71af3f");
    expect(result.portfolio[0].imageUrl).toBe("/api/qai-space/public-media/15523cec-7ca2-4fc4-b7a7-a37ae6e02c7c");
    expect(page.logo).toBe(privateQaiSpaceMediaUrl(MEDIA_ID));
  });

  it("does not rewrite external, data, or malformed media values", () => {
    expect(toPublicQaiSpaceMediaUrl("https://images.example/work.jpg")).toBe("https://images.example/work.jpg");
    expect(toPublicQaiSpaceMediaUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
    expect(toPublicQaiSpaceMediaUrl("/api/qai-space/media/not-a-uuid")).toBe("/api/qai-space/media/not-a-uuid");
    expect(qaiSpaceMediaId("/api/qai-space/media/not-a-uuid")).toBeNull();
  });

  it("authorizes only the current published field for the asset kind", () => {
    const page = defaultQaiPage();
    page.logo = privateQaiSpaceMediaUrl(MEDIA_ID);
    page.portfolio = [{
      id: "portfolio-item",
      imageUrl: publicQaiSpaceMediaUrl(MEDIA_ID),
      caption: "Hidden work",
      serviceId: null,
      visible: false,
      position: 0,
    }];

    expect(isPublishedQaiSpaceMedia(page, { id: MEDIA_ID, kind: "page-logo" })).toBe(true);
    expect(isPublishedQaiSpaceMedia(page, { id: MEDIA_ID, kind: "page-cover" })).toBe(false);
    expect(isPublishedQaiSpaceMedia(page, { id: MEDIA_ID, kind: "portfolio" })).toBe(false);

    page.portfolio[0].visible = true;
    expect(isPublishedQaiSpaceMedia(page, { id: MEDIA_ID, kind: "portfolio" })).toBe(true);
  });
});
