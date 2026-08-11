"use client";

import { useCallback, useEffect, useState } from "react";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { getReminderTemplates } from "./reminderTemplateRepository";
import { DEFAULT_REMINDER_TEMPLATES } from "./reminderTemplates";
import type { ReminderTemplateSet } from "./types";

export function useReminderTemplates(businessId: string) {
  const [templates, setTemplates] = useState<ReminderTemplateSet>(() => structuredClone(DEFAULT_REMINDER_TEMPLATES));
  const [isLoaded, setIsLoaded] = useState(false);
  const refresh = useCallback(() => {
    try {
      setTemplates(getReminderTemplates(businessId));
    } catch {
      setTemplates(structuredClone(DEFAULT_REMINDER_TEMPLATES));
    } finally {
      setIsLoaded(true);
    }
  }, [businessId]);
  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeToDataRefresh(refresh);
    return () => { window.clearTimeout(timeoutId); unsubscribe(); };
  }, [refresh]);
  return { templates, isLoaded, refresh };
}
