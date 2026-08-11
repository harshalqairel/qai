"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { getLatestReminder } from "../reminderRepository";
import { LOCAL_BUSINESS_ID } from "../reminderTemplates";
import type { ReminderHistoryRecord } from "../types";

export default function LastReminderStatus({ bookingId, businessId = LOCAL_BUSINESS_ID }: { bookingId: string; businessId?: string }) {
  const [latest, setLatest] = useState<ReminderHistoryRecord | null>(null);
  const refresh = useCallback(() => {
    try { setLatest(getLatestReminder(businessId, bookingId)); } catch { setLatest(null); }
  }, [businessId, bookingId]);
  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeToDataRefresh(refresh);
    return () => { window.clearTimeout(timeoutId); unsubscribe(); };
  }, [refresh]);
  if (!latest) return null;
  return <p className="mt-2 text-xs text-[var(--dashboard-muted-text)]">Last reminded: {new Date(latest.remindedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} via {latest.method}</p>;
}
