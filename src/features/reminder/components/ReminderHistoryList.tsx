"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, MessageCircle } from "lucide-react";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { getReminderHistory } from "../reminderRepository";
import { LOCAL_BUSINESS_ID } from "../reminderTemplates";
import type { ReminderHistoryRecord } from "../types";

export default function ReminderHistoryList({ bookingId, businessId = LOCAL_BUSINESS_ID }: { bookingId: string; businessId?: string }) {
  const [records, setRecords] = useState<ReminderHistoryRecord[]>([]);
  const refresh = useCallback(() => {
    try { setRecords(getReminderHistory(businessId, bookingId)); } catch { setRecords([]); }
  }, [businessId, bookingId]);
  useEffect(() => {
    const timeoutId = window.setTimeout(refresh, 0);
    const unsubscribe = subscribeToDataRefresh(refresh);
    return () => { window.clearTimeout(timeoutId); unsubscribe(); };
  }, [refresh]);

  return (
    <section className="mt-6 border-t border-border pt-6" aria-labelledby="payment-reminders-heading">
      <h3 id="payment-reminders-heading" className="font-semibold">Reminder history</h3>
      <p className="mt-1 text-sm text-muted-foreground">History is saved on this browser while Qai is in local mode.</p>
      {records.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No reminders marked yet.</p> : (
        <div className="mt-4 space-y-2">
          {records.map((record) => {
            const date = new Date(record.remindedAt);
            const Icon = record.method === "WhatsApp" ? MessageCircle : Mail;
            return (
              <article key={record.id} className="rounded-xl border border-border p-3 text-sm">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className="font-semibold">{record.method} · {record.reminderType === "overdue" ? "Overdue" : "Due Soon"}</p>
                      <time className="text-xs text-muted-foreground" dateTime={record.remindedAt}>{date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</time>
                    </div>
                    <p className="mt-2 font-medium tabular-nums">{formatRupiah(record.outstandingBalance)} outstanding</p>
                    <p className="mt-1 text-xs text-muted-foreground">Marked as reminded</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
