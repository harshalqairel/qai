export const QAI_SPACE_OWNER_PATH = "/space";

export const QAI_SPACE_TABS = ["Profile", "Design", "Portfolio", "Services", "Booking", "Requests", "Preview"] as const;

export type QaiSpaceTab = (typeof QAI_SPACE_TABS)[number];

export function normalizeQaiSpaceTab(value: string | null): QaiSpaceTab {
  if (value === "Page") return "Profile";
  return QAI_SPACE_TABS.some((tab) => tab === value) ? value as QaiSpaceTab : "Profile";
}

export function qaiSpaceHref(tab?: QaiSpaceTab): string {
  return tab ? `${QAI_SPACE_OWNER_PATH}?tab=${encodeURIComponent(tab)}` : QAI_SPACE_OWNER_PATH;
}
