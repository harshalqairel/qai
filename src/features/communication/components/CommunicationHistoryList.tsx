"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { listClientCommunications } from "../communicationRepository";
import type { ClientCommunication } from "../types";

export default function CommunicationHistoryList({ bookingId, customerId }: { bookingId?: string; customerId?: string }) {
  const [records, setRecords] = useState<ClientCommunication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const refresh = useCallback(async () => {
    try {
      setRecords(await listClientCommunications({ bookingId, customerId }));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [bookingId, customerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const unsubscribe = subscribeToDataRefresh(() => { void refresh(); });
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [refresh]);

  const headingId = `communication-history-${bookingId ?? customerId ?? "client"}`;
  return (
    <section className="mt-6 border-t border-border pt-6" aria-labelledby={headingId}>
      <h3 id={headingId} className="font-semibold">Communication history</h3>
      <p className="mt-1 text-sm text-muted-foreground">Records drafts opened from Qai. It does not claim the client received or read them.</p>
      {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading communication history…</p> : loadError ? <p className="mt-4 text-sm text-destructive">Communication history could not be loaded.</p> : records.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No client messages opened from Qai yet.</p> : <div className="mt-4 space-y-2">
        {records.map((record) => {
          const Icon = record.channel === "whatsapp" ? MessageCircle : Mail;
          const label = record.actionStatus === "whatsapp_opened" ? "Opened in WhatsApp" : "Email draft opened";
          const openedAt = new Date(record.openedAt ?? record.createdAt);
          return <article key={record.id} className="rounded-xl border border-border p-3 text-sm"><div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="font-semibold">{label}</p><time className="text-xs text-muted-foreground" dateTime={record.openedAt ?? record.createdAt}>{openedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time></div><p className="mt-1 truncate text-xs text-muted-foreground">{record.recipientSnapshot}</p><p className="mt-2 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{record.bodySnapshot}</p></div></div></article>;
        })}
      </div>}
    </section>
  );
}
