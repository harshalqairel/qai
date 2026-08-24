export type SocialProfilePlatform = "instagram" | "tiktok";

const PLATFORM_HOSTS: Record<SocialProfilePlatform, ReadonlySet<string>> = {
  instagram: new Set(["instagram.com", "www.instagram.com"]),
  tiktok: new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]),
};

const HANDLE_PATTERNS: Record<SocialProfilePlatform, RegExp> = {
  instagram: /^[a-zA-Z0-9._]{1,30}$/,
  tiktok: /^[a-zA-Z0-9._]{2,24}$/,
};

export function normalizeSocialProfile(platform: SocialProfilePlatform, value: string): string | null {
  const input = value.normalize("NFKC").trim();
  if (!input) return "";

  let handle = input.replace(/^@/, "");
  if (/^https?:\/\//i.test(input)) {
    try {
      const url = new URL(input);
      if (!PLATFORM_HOSTS[platform].has(url.hostname.toLowerCase())) return null;
      const segments = url.pathname.split("/").filter(Boolean);
      handle = platform === "tiktok" ? (segments[0]?.replace(/^@/, "") ?? "") : (segments[0] ?? "");
    } catch {
      return null;
    }
  }

  return HANDLE_PATTERNS[platform].test(handle) ? handle : null;
}

export function socialProfileUrl(platform: SocialProfilePlatform, value: string): string | null {
  const handle = normalizeSocialProfile(platform, value);
  if (!handle) return null;
  return platform === "tiktok"
    ? `https://www.tiktok.com/@${handle}`
    : `https://www.instagram.com/${handle}`;
}
