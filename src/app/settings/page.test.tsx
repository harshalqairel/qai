// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";
import { isCloudModeEnabled } from "@/lib/supabase/config";

vi.mock("@/lib/supabase/config", () => ({ isCloudModeEnabled: vi.fn() }));
vi.mock("@/features/service-category/hooks/useServiceCategories", () => ({
  useServiceCategories: () => ({ isLoading: false, categories: [], usageCounts: {} }),
}));
vi.mock("@/features/expense-category/hooks/useExpenseCategories", () => ({
  useExpenseCategories: () => ({ isLoading: false, categories: [], usageCounts: {} }),
}));
vi.mock("@/features/backup/components/DataBackupSection", () => ({
  default: () => <button type="button">Download backup</button>,
}));
vi.mock("@/features/import/components/SpreadsheetImportSection", () => ({
  default: () => <button type="button">Import Excel or CSV</button>,
}));
vi.mock("@/features/category/components/CategoryManager", () => ({ default: () => null }));
vi.mock("@/features/reminder/components/PaymentReminderSettings", () => ({ default: () => null }));
vi.mock("@/features/appearance/AppearanceSettings", () => ({ default: () => null }));
vi.mock("@/features/invoice/InvoiceSharingSettings", () => ({ default: () => null }));
vi.mock("@/features/notifications/NotificationSettings", () => ({ default: () => null }));
vi.mock("@/features/booking-questionnaire/BookingQuestionnaireSettings", () => ({ default: () => null }));
vi.mock("@/features/calendar/components/GoogleCalendarSyncCard", () => ({ default: () => null }));

beforeEach(() => {
  window.history.replaceState({}, "", "/settings?section=data-backup");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Settings Backup & Restore", () => {
  it("shows an unavailable cloud feature without backup, restore, or legacy-import actions", () => {
    vi.mocked(isCloudModeEnabled).mockReturnValue(true);

    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Backup & Restore", level: 2 })).toBeTruthy();
    expect(screen.getByText("Coming soon")).toBeTruthy();
    expect(screen.getByText("Download a complete backup of your Qai workspace and restore it when needed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /download backup/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /restore backup/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /import/i })).toBeNull();
  });

  it("keeps the existing local-only tools outside cloud mode", () => {
    vi.mocked(isCloudModeEnabled).mockReturnValue(false);

    render(<SettingsPage />);

    expect(screen.getByRole("button", { name: "Download backup" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import Excel or CSV" })).toBeTruthy();
    expect(screen.queryByText("Coming soon")).toBeNull();
  });
});
