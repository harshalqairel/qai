import type { QaiPageConfig } from "@/features/qai-page/validation";

export type QaiSpacePublicMediaKind = "page-logo" | "page-cover" | "portfolio";

const PRIVATE_MEDIA_PREFIX = "/api/qai-space/media/";
const PUBLIC_MEDIA_PREFIX = "/api/qai-space/public-media/";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mediaIdFromPrefix(value: string, prefix: string): string | null {
  if (!value.startsWith(prefix)) return null;
  const id = value.slice(prefix.length);
  return UUID_PATTERN.test(id) ? id : null;
}

export function privateQaiSpaceMediaUrl(id: string): string {
  return `${PRIVATE_MEDIA_PREFIX}${id}`;
}

export function publicQaiSpaceMediaUrl(id: string): string {
  return `${PUBLIC_MEDIA_PREFIX}${id}`;
}

export function qaiSpaceMediaId(value: string): string | null {
  return mediaIdFromPrefix(value, PRIVATE_MEDIA_PREFIX) ?? mediaIdFromPrefix(value, PUBLIC_MEDIA_PREFIX);
}

export function toPublicQaiSpaceMediaUrl(value: string): string {
  const id = qaiSpaceMediaId(value);
  return id ? publicQaiSpaceMediaUrl(id) : value;
}

export function withPublicQaiSpaceMediaUrls(page: QaiPageConfig): QaiPageConfig {
  return {
    ...page,
    logo: toPublicQaiSpaceMediaUrl(page.logo),
    coverImage: toPublicQaiSpaceMediaUrl(page.coverImage),
    portfolio: page.portfolio.map((item) => ({
      ...item,
      imageUrl: toPublicQaiSpaceMediaUrl(item.imageUrl),
    })),
  };
}

export function isPublishedQaiSpaceMedia(
  page: QaiPageConfig,
  asset: { id: string; kind: QaiSpacePublicMediaKind },
): boolean {
  const matches = (value: string) => qaiSpaceMediaId(value) === asset.id;
  if (asset.kind === "page-logo") return matches(page.logo);
  if (asset.kind === "page-cover") return matches(page.coverImage);
  return page.portfolio.some((item) => item.visible && matches(item.imageUrl));
}
