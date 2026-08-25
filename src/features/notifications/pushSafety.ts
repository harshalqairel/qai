export function safePushPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  try {
    const base = new URL("https://qai.internal");
    const target = new URL(value, base);
    return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
