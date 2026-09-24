// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";
import { isCloudModeEnabled } from "@/lib/supabase/config";

vi.mock("@/features/service-category/hooks/useServiceCategories", () => ({
  useServiceCategories: () => ({ isLoading: false, categories: [], usageCounts: {} }),
}));
vi.mock("@/features/expense-category/hooks/useExpenseCategories", () => ({
  useExpenseCategories: () => ({ isLoading: false, categories: [], usageCounts: {} }),
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
  vi.unstubAllEnvs();
});

function setCloudEnvironment(configured: boolean) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", configured ? "https://example.supabase.co" : "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", configured ? "test-publishable" : "");
  vi.stubEnv("NEXT_PUBLIC_QAI_CLOUD_ENABLED", "true");
  vi.stubEnv("NEXT_PUBLIC_QAI_VALIDATION_ENABLED", "false");
  expect(isCloudModeEnabled()).toBe(configured);
}

function expectUnavailableBackup() {
  expect(screen.getByRole("heading", { name: "Backup & Restore", level: 2 })).toBeTruthy();
  expect(screen.getByText("Coming soon")).toBeTruthy();
  expect(screen.getByText("Download a complete backup of your Qai workspace and restore it when needed.")).toBeTruthy();
  expect(screen.queryByText("Data backup")).toBeNull();
  expect(screen.queryByText("Save your Qai data to a file, or restore it from a backup.")).toBeNull();
  expect(screen.queryByRole("button", { name: /download backup|restore backup|import/i })).toBeNull();
}

describe("Settings Backup & Restore", () => {
  it("shows Coming soon for authenticated cloud users on desktop", () => {
    setCloudEnvironment(true);
    window.innerWidth = 1280;
    render(<SettingsPage />);

    expect(within(screen.getByRole("navigation", { name: "Settings sections" })).getByRole("button", { name: "Backup & Restore" })).toBeTruthy();
    expectUnavailableBackup();
  });

  it("shows Coming soon after selecting Backup & Restore on mobile", () => {
    setCloudEnvironment(true);
    window.innerWidth = 390;
    window.history.replaceState({}, "", "/settings");
    render(<SettingsPage />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "Settings" })).getByRole("button", { name: /Backup & Restore/ }));

    expect(screen.getByRole("heading", { name: "Backup & Restore", level: 1 })).toBeTruthy();
    expectUnavailableBackup();
  });

  it("never exposes the old backup controls when Preview cloud configuration is missing", () => {
    setCloudEnvironment(false);
    window.innerWidth = 390;
    render(<SettingsPage />);

    expectUnavailableBackup();
  });
});
