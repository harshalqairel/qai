import { z } from "zod";

export const DASHBOARD_SECTION_IDS = ["setup", "income", "expenses", "profit", "unpaid", "upcoming", "due-soon", "overdue", "requests"] as const;
export type DashboardSectionId = typeof DASHBOARD_SECTION_IDS[number];
export type DashboardPreference = { id: DashboardSectionId; visible: boolean };

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  setup: "Setup checklist", income: "Income", expenses: "Expenses", profit: "Profit", unpaid: "Unpaid amount", upcoming: "Upcoming jobs",
  "due-soon": "Payments due soon", overdue: "Overdue payments", requests: "New requests",
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreference[] = DASHBOARD_SECTION_IDS.map((id) => ({ id, visible: true }));
const preferenceSchema = z.array(z.object({ id: z.enum(DASHBOARD_SECTION_IDS), visible: z.boolean() })).length(DASHBOARD_SECTION_IDS.length);
const STORAGE_KEY = "qai:dashboard-preferences";

export function normalizeDashboardPreferences(value: unknown): DashboardPreference[] {
  const parsed = preferenceSchema.safeParse(value);
  if (!parsed.success || new Set(parsed.data.map((item) => item.id)).size !== DASHBOARD_SECTION_IDS.length) return structuredClone(DEFAULT_DASHBOARD_PREFERENCES);
  if (!parsed.data.some((item) => item.visible)) return structuredClone(DEFAULT_DASHBOARD_PREFERENCES);
  return parsed.data;
}

export function moveDashboardSection(preferences: DashboardPreference[], id: DashboardSectionId, direction: -1 | 1): DashboardPreference[] {
  const index = preferences.findIndex((item) => item.id === id); const target = index + direction;
  if (index < 0 || target < 0 || target >= preferences.length) return preferences;
  const next = [...preferences]; [next[index], next[target]] = [next[target], next[index]]; return next;
}

export function setDashboardSectionVisible(preferences: DashboardPreference[], id: DashboardSectionId, visible: boolean): DashboardPreference[] {
  const next = preferences.map((item) => item.id === id ? { ...item, visible } : item);
  return next.some((item) => item.visible) ? next : preferences;
}

export function loadDashboardPreferences(): DashboardPreference[] {
  if (typeof window === "undefined") return structuredClone(DEFAULT_DASHBOARD_PREFERENCES);
  try { return normalizeDashboardPreferences(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null")); } catch { return structuredClone(DEFAULT_DASHBOARD_PREFERENCES); }
}

export function saveDashboardPreferences(preferences: DashboardPreference[]): DashboardPreference[] {
  const normalized = normalizeDashboardPreferences(preferences); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized)); return normalized;
}
