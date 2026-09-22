import type { Metadata } from "next";
import { headers } from "next/headers";

import { isCloudModeEnabled } from "@/lib/supabase/config";

type PublicPageMetadata = {
  businessName: string;
  shortDescription: string;
  coverImage: string;
};

function publicMetadataDescription(page: PublicPageMetadata): string {
  return page.shortDescription.trim() || `View services and send a booking request to ${page.businessName}.`;
}

async function loadPublicMetadata(slug: string): Promise<PublicPageMetadata | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return null;
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const route = isCloudModeEnabled() ? "/api/qai-space" : "/api/validation";
  try {
    const response = await fetch(`${protocol}://${host}${route}?scope=page&slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const result = await response.json() as { data?: Partial<PublicPageMetadata> };
    if (!result.data?.businessName) return null;
    return {
      businessName: result.data.businessName,
      shortDescription: result.data.shortDescription ?? "",
      coverImage: result.data.coverImage ?? "",
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPublicMetadata(slug);
  if (!page) {
    return {
      title: "Qai Space",
      description: "Explore services and send a booking request through Qai Space.",
      robots: { index: false, follow: false },
    };
  }
  const description = publicMetadataDescription(page);
  const image = /^(https?:\/\/|\/)/.test(page.coverImage) ? page.coverImage : "";
  return {
    title: `${page.businessName} | Qai Space`,
    description,
    alternates: { canonical: `/q/${slug}` },
    openGraph: {
      title: page.businessName,
      description,
      type: "website",
      url: `/q/${slug}`,
      images: image ? [{ url: image, alt: page.businessName }] : undefined,
    },
  };
}

export default function PublicQaiSpaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
