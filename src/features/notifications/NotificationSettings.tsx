"use client";

import { Bell, BellOff, Check, Send } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";
import {
  NOTIFICATION_CATEGORIES,
  getNotificationPreferences,
  notificationPermission,
  requestNotificationPermission,
  saveNotificationPreferences,
  type NotificationCategory,
} from "./notificationPreferences";
import { currentPushEnvironment, getPushRegistration, subscribeCurrentDevice } from "./pushSubscription";

type DeviceState = "checking" | "enabled" | "disabled" | "not-configured" | "unsupported" | "ios-install-required" | "error";

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState(getNotificationPreferences);
  const [permission, setPermission] = useState(notificationPermission);
  const [requesting, setRequesting] = useState(false);
  const [deviceState, setDeviceState] = useState<DeviceState>("checking");

  async function refreshDeviceState() {
    const environment = currentPushEnvironment();
    if (environment !== "supported") { setDeviceState(environment); return; }
    try {
      const registration = await getPushRegistration();
      const subscription = await registration.pushManager.getSubscription();
      const params = new URLSearchParams(subscription ? { endpoint: subscription.endpoint } : {});
      const response = await fetch(`/api/notifications/push?${params}`, { cache: "no-store" });
      const result = await response.json() as { data?: { configured: boolean; subscribed: boolean } };
      if (!result.data?.configured) setDeviceState("not-configured");
      else setDeviceState(subscription && result.data.subscribed ? "enabled" : "disabled");
    } catch { setDeviceState("error"); }
  }

  useEffect(() => { const timer = window.setTimeout(() => { void refreshDeviceState(); }, 0); return () => window.clearTimeout(timer); }, []);

  function persist(next: typeof preferences) {
    saveNotificationPreferences(next);
    setPreferences(next);
  }

  async function turnOn() {
    setRequesting(true);
    try {
      if (currentPushEnvironment() !== "supported") { await refreshDeviceState(); return; }
      const configResponse = await fetch("/api/notifications/push", { cache: "no-store" });
      const config = await configResponse.json() as { data?: { configured: boolean; publicKey: string } };
      if (!config.data?.configured || !config.data.publicKey) { setDeviceState("not-configured"); notify.error("Push delivery is not configured for this deployment."); return; }
      const nextPermission = await requestNotificationPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        persist({ ...preferences, enabled: false });
        notify.info(nextPermission === "unsupported" ? "Notifications are not supported by this browser." : "Notifications remain off. You can keep using Qai normally.");
        return;
      }
      const subscription = await subscribeCurrentDevice(config.data.publicKey);
      const response = await fetch("/api/notifications/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON(), categories: preferences.categories, userAgent: navigator.userAgent }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { await subscription.unsubscribe(); throw new Error(result.error ?? "Could not register this device."); }
      persist({ ...preferences, enabled: true }); setDeviceState("enabled");
      notify.success("Push notifications enabled on this device.");
    } catch (error) {
      setDeviceState("error"); notify.error(error instanceof Error ? error.message : "Could not enable push notifications.");
    } finally {
      setRequesting(false);
    }
  }

  async function turnOff() {
    setRequesting(true);
    try {
      const registration = await getPushRegistration(); const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/notifications/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      persist({ ...preferences, enabled: false }); setDeviceState("disabled"); notify.success("Push notifications turned off on this device.");
    } catch { notify.error("Could not turn off push notifications."); }
    finally { setRequesting(false); }
  }

  async function sendTest() {
    setRequesting(true);
    try {
      const subscription = await (await getPushRegistration()).pushManager.getSubscription(); if (!subscription) throw new Error("This device is not subscribed.");
      const response = await fetch("/api/notifications/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", endpoint: subscription.endpoint }) });
      const result = await response.json() as { error?: string }; if (!response.ok) throw new Error(result.error);
      notify.success("Real push sent. It may take a few seconds to appear.");
    } catch (error) { notify.error(error instanceof Error ? error.message : "Could not send a test push."); }
    finally { setRequesting(false); }
  }

  function toggleCategory(category: NotificationCategory) {
    const categories = preferences.categories.includes(category)
      ? preferences.categories.filter((item) => item !== category)
      : [...preferences.categories, category];
    persist({ ...preferences, categories });
    if (deviceState === "enabled") void getPushRegistration().then((registration) => registration.pushManager.getSubscription()).then((subscription) => subscription ? fetch("/api/notifications/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "subscribe", subscription: subscription.toJSON(), categories, userAgent: navigator.userAgent }) }) : undefined).catch(() => notify.error("Could not update push categories for this device."));
  }

  const active = preferences.enabled && permission === "granted" && deviceState === "enabled";

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <span className={`flex size-11 items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {active ? <Bell className="size-5" aria-hidden="true" /> : <BellOff className="size-5" aria-hidden="true" />}
          </span>
          <h2 className="mt-4 text-lg font-bold tracking-tight">Notifications</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">Choose important operational updates. Qai asks for browser permission only when you turn notifications on.</p>
        </div>
        {active ? (
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={requesting} onClick={() => void sendTest()}><Send className="size-4" />Send test</Button><Button type="button" variant="outline" disabled={requesting} onClick={() => void turnOff()}>Turn off</Button></div>
        ) : (
          <Button type="button" onClick={() => void turnOn()} disabled={requesting || permission === "denied" || deviceState === "not-configured" || deviceState === "unsupported" || deviceState === "ios-install-required" || deviceState === "checking"}>
            <Bell className="size-4" aria-hidden="true" /> {requesting ? "Requesting…" : "Turn on notifications"}
          </Button>
        )}
      </div>

      {permission === "denied" && (
        <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Notifications are blocked in this browser. Qai will continue normally; you can change permission in your browser settings.</p>
      )}
      {deviceState === "enabled" && <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">Enabled on this device. Push can arrive while Qai is in the background.</p>}
      {deviceState === "ios-install-required" && <p className="mt-5 rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">On iPhone, add Qai to your Home Screen, open the installed Qai app, then return here to enable push notifications.</p>}
      {deviceState === "unsupported" && <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">This browser or device does not support Web Push.</p>}
      {deviceState === "not-configured" && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Push delivery is not configured for this deployment. Qai will not claim this device is enabled.</p>}
      {deviceState === "error" && <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Qai could not confirm this device’s push status. Check your connection and try again.</p>}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="font-semibold">Notify me about</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const selected = preferences.categories.includes(category.id);
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleCategory(category.id)}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted"
              >
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}>
                  {selected && <Check className="size-4" aria-hidden="true" />}
                </span>
                {category.label}
              </button>
            );
          })}
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Qai does not send payment-received notifications because manual payments cannot be independently verified.</p>
      </div>
    </section>
  );
}
