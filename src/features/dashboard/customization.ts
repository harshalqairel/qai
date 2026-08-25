import { z } from "zod";
import { queueWorkspaceDocumentWrite } from "@/lib/validation/workspaceSync";

export const DASHBOARD_SECTION_IDS = ["setup", "income", "expenses", "profit", "unpaid", "yearly", "upcoming", "due-soon", "overdue", "requests"] as const;
export type DashboardSectionId = typeof DASHBOARD_SECTION_IDS[number];
export type DashboardPreference = { id: DashboardSectionId; visible: boolean };

export const DASHBOARD_SECTION_LABELS: Record<DashboardSectionId, string> = {
  setup: "Setup checklist", income: "Income by category", expenses: "Expenses by category", profit: "Profit", unpaid: "Unpaid amount", yearly: "Yearly income, expenses & profit", upcoming: "Upcoming jobs",
  "due-soon": "Payments due soon", overdue: "Overdue payments", requests: "New requests",
};

export const DEFAULT_DASHBOARD_PREFERENCES: DashboardPreference[] = DASHBOARD_SECTION_IDS.map((id) => ({ id, visible: true }));
const preferenceSchema = z.array(z.object({ id: z.enum(DASHBOARD_SECTION_IDS), visible: z.boolean() }));
const STORAGE_KEY = "qai:dashboard-preferences";

export function normalizeDashboardPreferences(value: unknown): DashboardPreference[] {
  const parsed = preferenceSchema.safeParse(value);
  if (!parsed.success || parsed.data.length === 0 || new Set(parsed.data.map((item) => item.id)).size !== parsed.data.length) return structuredClone(DEFAULT_DASHBOARD_PREFERENCES);
  const completed = [...parsed.data, ...DASHBOARD_SECTION_IDS.filter((id) => !parsed.data.some((item) => item.id === id)).map((id) => ({ id, visible: true }))];
  if (!completed.some((item) => item.visible)) return structuredClone(DEFAULT_DASHBOARD_PREFERENCES);
  return completed;
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
  const normalized = normalizeDashboardPreferences(preferences); const serialized = JSON.stringify(normalized); window.localStorage.setItem(STORAGE_KEY, serialized); queueWorkspaceDocumentWrite(STORAGE_KEY, serialized); return normalized;
}
