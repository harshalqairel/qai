// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getNotificationPreferences,
  requestNotificationPermission,
  saveNotificationPreferences,
} from "./notificationPreferences";

describe("notification preferences", () => {
  beforeEach(() => window.localStorage.clear());

  it("is disabled by default and omits unsupported payment-received alerts", () => {
    const preferences = getNotificationPreferences();
    expect(preferences.enabled).toBe(false);
    expect(preferences.categories).not.toContain("paymentReceived");
  });

  it("persists category choices", () => {
    saveNotificationPreferences({ userId: "local-user", enabled: true, categories: ["bookingRequests"] });
    expect(getNotificationPreferences()).toMatchObject({ enabled: true, categories: ["bookingRequests"] });
  });

  it("requests browser permission only when explicitly called", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(await requestNotificationPermission()).toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });
});
