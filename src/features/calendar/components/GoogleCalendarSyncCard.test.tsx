// @vitest-environment happy-dom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const notifications = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  isCloudModeEnabled: () => true,
  isValidationModeEnabled: () => false,
}));
vi.mock("@/lib/notifications", () => ({ notify: notifications }));

import GoogleCalendarSyncCard from "./GoogleCalendarSyncCard";

function response(data: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

const connected = {
  configured: true,
  status: "connected",
  googleAccount: "owner@example.com",
  targetCalendarId: "primary",
  lastSyncAt: "2026-09-06T03:00:00.000Z",
  lastSyncAttemptAt: "2026-09-06T03:00:00.000Z",
  lastError: null,
  calendars: [
    { id: "primary", name: "Primary", primary: true },
    { id: "studio", name: "Studio", primary: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/settings?section=integrations");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GoogleCalendarSyncCard", () => {
  it("shows a retryable error instead of an endless spinner when status loading fails", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ error: "Calendar status could not be loaded." }, 503))
      .mockImplementationOnce(() => response({ data: connected }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<GoogleCalendarSyncCard />);

    expect((await screen.findByRole("alert")).textContent).toContain("Calendar status could not be loaded.");
    expect(screen.queryByLabelText("Loading Calendar connection")).toBeNull();

    await user.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("owner@example.com")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows the cloud Connect action while disconnected", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ data: {
      ...connected,
      status: "disconnected",
      googleAccount: null,
      targetCalendarId: null,
      lastSyncAt: null,
      calendars: [],
    } })));
    render(<GoogleCalendarSyncCard />);

    expect((await screen.findByRole("button", { name: /Connect/ })).getAttribute("href"))
      .toBe("/api/integrations/google-calendar/connect");
    expect(screen.getByText("Not connected")).toBeTruthy();
  });

  it("shows account, destination, last sync, and a Sync now action when connected", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ data: connected })));
    render(<GoogleCalendarSyncCard />);

    expect(await screen.findByText("owner@example.com")).toBeTruthy();
    expect((screen.getByRole("combobox", { name: "Send schedules to" }) as HTMLSelectElement).value)
      .toBe("primary");
    expect(screen.getByRole("button", { name: /Sync now/ })).toBeTruthy();
    expect(screen.getByText(/Last synced/)).toBeTruthy();
  });

  it("presents a retryable connection failure distinctly from reconnect_required", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ data: {
      ...connected,
      status: "error",
      lastError: "Google Calendar could not be reached. Try again.",
    } })));
    render(<GoogleCalendarSyncCard />);

    expect(await screen.findByText("Try again")).toBeTruthy();
    expect(screen.getByText("Google Calendar could not be reached. Try again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sync now/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Reconnect$/ })).toBeNull();
  });

  it("shows Reconnect only when authorization was definitively rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(() => response({ data: {
      ...connected,
      status: "reconnect_required",
      lastError: "Google Calendar needs to be reconnected.",
      calendars: [],
    } })));
    render(<GoogleCalendarSyncCard />);

    expect(await screen.findByText("Reconnect required")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Reconnect$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sync now/ })).toBeNull();
  });

  it("persists a writable calendar selection and reloads server state", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ data: connected }))
      .mockImplementationOnce(() => response({ data: { ok: true } }))
      .mockImplementationOnce(() => response({ data: { ...connected, targetCalendarId: "studio" } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<GoogleCalendarSyncCard />);
    const select = await screen.findByRole("combobox", { name: "Send schedules to" });

    await user.selectOptions(select, "studio");
    await waitFor(() => expect((select as HTMLSelectElement).value).toBe("studio"));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/integrations/google-calendar", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ calendarId: "studio" }),
    }));
    expect(notifications.success).toHaveBeenCalledWith("Google Calendar updated. Sync now to reconcile schedules.");
  });

  it("does not report a partial sync as successful", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response({ data: connected }))
      .mockImplementationOnce(() => response({
        data: { created: 2, failed: 1 },
        error: "Some schedules could not be synced.",
      }, 502))
      .mockImplementationOnce(() => response({ data: {
        ...connected,
        status: "error",
        lastError: "Some schedules could not be synced.",
      } }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<GoogleCalendarSyncCard />);

    await user.click(await screen.findByRole("button", { name: /Sync now/ }));
    await waitFor(() => expect(notifications.error).toHaveBeenCalledWith("Some schedules could not be synced."));
    expect(notifications.success).not.toHaveBeenCalledWith(expect.stringContaining("synced"));
  });
});
