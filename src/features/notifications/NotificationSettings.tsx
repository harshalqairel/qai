"use client";

import { Bell, BellOff, Check } from "lucide-react";
import { useState } from "react";

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

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState(getNotificationPreferences);
  const [permission, setPermission] = useState(notificationPermission);
  const [requesting, setRequesting] = useState(false);

  function persist(next: typeof preferences) {
    saveNotificationPreferences(next);
    setPreferences(next);
  }

  async function turnOn() {
    setRequesting(true);
    try {
      const nextPermission = await requestNotificationPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") {
        persist({ ...preferences, enabled: false });
        notify.info(nextPermission === "unsupported" ? "Notifications are not supported by this browser." : "Notifications remain off. You can keep using Qai normally.");
        return;
      }
      persist({ ...preferences, enabled: true });
      notify.success("Notifications turned on.");
    } finally {
      setRequesting(false);
    }
  }

  function toggleCategory(category: NotificationCategory) {
    const categories = preferences.categories.includes(category)
      ? preferences.categories.filter((item) => item !== category)
      : [...preferences.categories, category];
    persist({ ...preferences, categories });
  }

  const active = preferences.enabled && permission === "granted";

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
          <Button type="button" variant="outline" onClick={() => persist({ ...preferences, enabled: false })}>Turn off</Button>
        ) : (
          <Button type="button" onClick={() => void turnOn()} disabled={requesting || permission === "denied"}>
            <Bell className="size-4" aria-hidden="true" /> {requesting ? "Requesting…" : "Turn on notifications"}
          </Button>
        )}
      </div>

      {permission === "denied" && (
        <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Notifications are blocked in this browser. Qai will continue normally; you can change permission in your browser settings.</p>
      )}

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
