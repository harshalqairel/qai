"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, ChevronRight, ExternalLink, LoaderCircle, MoreHorizontal, RefreshCw, Unplug } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { notify } from "@/lib/notifications";

type Status = {
  configured: boolean;
  status: "unavailable" | "disconnected" | "connected" | "reconnect_required";
  google_account_email?: string | null;
  target_calendar_id?: string | null;
  last_sync_at?: string | null;
  last_error?: string | null;
  calendars: Array<{ id: string; name: string; primary: boolean }>;
};

export default function GoogleCalendarSyncCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"load" | "sync" | "select" | "disconnect" | null>("load");

  const load = useCallback(async () => {
    if (!isValidationModeEnabled()) return;
    try {
      const response = await fetch("/api/integrations/google-calendar", { cache: "no-store" });
      const result = await response.json() as { data?: Status };
      if (response.ok && result.data) setStatus(result.data);
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void load();
    const query = new URLSearchParams(window.location.search).get("calendar");
    if (query === "connected") notify.success("Google Calendar connected.");
    else if (query === "cancelled") notify.info("Google Calendar connection was cancelled.");
    else if (query === "error" || query === "not-configured") notify.error("Google Calendar could not be connected.");
  }, [load]);

  if (!isValidationModeEnabled()) return null;

  async function select(calendarId: string) {
    setBusy("select");
    try {
      const response = await fetch("/api/integrations/google-calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId }),
      });
      if (!response.ok) throw new Error();
      await load();
      notify.success("Target calendar updated.");
    } catch {
      notify.error("Could not select that calendar.");
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const response = await fetch("/api/integrations/google-calendar/sync", { method: "POST" });
      const result = await response.json() as { data?: Record<string, number>; error?: string };
      if (!response.ok || !result.data) throw new Error(result.error);
      await load();
      const changed = (result.data.created ?? 0) + (result.data.updated ?? 0) + (result.data.cancelled ?? 0);
      notify.success(changed ? `Google Calendar synced · ${changed} changes.` : "Google Calendar is already up to date.");
      if (result.data.failed) notify.error(`${result.data.failed} events could not be synced. Qai data was not changed.`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Calendar sync failed. Qai data was not changed.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar? Existing Qai-created events will remain in Google Calendar.")) return;
    setBusy("disconnect");
    try {
      await fetch("/api/integrations/google-calendar", { method: "DELETE" });
      await load();
      notify.success("Google Calendar disconnected.");
    } catch {
      notify.error("Could not disconnect Google Calendar.");
    } finally {
      setBusy(null);
    }
  }

  const connected = status?.status === "connected";

  const identity = connected ? status?.google_account_email || "Connected Google account" : "One Google event for each Qai schedule.";
  const destination = status?.calendars.find((calendar) => calendar.id === status.target_calendar_id);
  const statusControls = connected ? <div className="flex items-center gap-2">
    <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => void sync()}>
      {busy === "sync" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Sync now
    </Button>
    <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Google Calendar options" />}><MoreHorizontal className="size-5" aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48"><DropdownMenuItem variant="destructive" disabled={busy !== null} onClick={() => void disconnect()}><Unplug className="size-4" aria-hidden="true" />Disconnect</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </div> : status?.configured ? <Button size="sm" render={<a href="/api/integrations/google-calendar/connect" />}><ExternalLink className="size-4" aria-hidden="true" />{status.status === "reconnect_required" ? "Reconnect" : "Connect"}</Button> : <p className="text-xs text-muted-foreground">Not configured</p>;

  return <>
    <details className="group border-y border-border bg-card md:hidden">
      <summary className="flex min-h-16 cursor-pointer list-none touch-manipulation items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarCheck2 className="size-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold">Google Calendar{connected && <span className="text-xs font-medium text-emerald-700">Connected</span>}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{connected ? `${destination?.name ?? "Primary calendar"} · ${identity}` : identity}</span></span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" aria-hidden="true" />
      </summary>
      <div className="space-y-4 border-t border-border px-4 py-4">
        {connected && <div><Label htmlFor="target-google-calendar-mobile">Send schedules to</Label><select id="target-google-calendar-mobile" className="native-control mt-2" value={status.target_calendar_id ?? ""} disabled={busy !== null} onChange={(event) => void select(event.target.value)}>{status.calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}{calendar.primary ? " (Primary)" : ""}</option>)}</select></div>}
        <div className="flex items-center justify-between gap-3"><p className="text-xs leading-5 text-muted-foreground">{status?.last_sync_at ? `Last synced ${new Date(status.last_sync_at).toLocaleString()}` : "Qai remains the source of truth."}</p>{busy === "load" || !status ? <LoaderCircle className="size-5 animate-spin" aria-label="Loading Calendar connection" /> : statusControls}</div>
      </div>
    </details>
    <section className="surface-card hidden overflow-hidden md:block" aria-labelledby="google-calendar-heading">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="google-calendar-heading" className="font-semibold">Google Calendar</h2>
              {connected && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Connected</span>}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {identity}
            </p>
          </div>
        </div>

        {busy === "load" || !status ? (
          <LoaderCircle className="size-5 animate-spin self-center text-muted-foreground" aria-label="Loading Calendar connection" />
        ) : !status.configured ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Not configured for this deployment</p>
        ) : !connected ? (
          <Button render={<a href="/api/integrations/google-calendar/connect" />}>
            <ExternalLink className="size-4" aria-hidden="true" />
            {status.status === "reconnect_required" ? "Reconnect" : "Connect"}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={busy !== null} onClick={() => void sync()}>
              {busy === "sync" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sync now
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Google Calendar options" />}>
                <MoreHorizontal className="size-5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem variant="destructive" disabled={busy !== null} onClick={() => void disconnect()}>
                  <Unplug className="size-4" aria-hidden="true" /> Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {connected && (
        <div className="grid gap-3 border-t border-border bg-slate-50/70 px-4 py-4 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-end sm:px-5">
          <div>
            <Label htmlFor="target-google-calendar">Send schedules to</Label>
            <select
              id="target-google-calendar"
              className="native-control mt-2"
              value={status.target_calendar_id ?? ""}
              disabled={busy !== null}
              onChange={(event) => void select(event.target.value)}
            >
              {status.calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>{calendar.name}{calendar.primary ? " (Primary)" : ""}</option>
              ))}
            </select>
          </div>
          <p className="text-xs leading-5 text-muted-foreground sm:text-right">
            {status.last_sync_at ? `Last synced ${new Date(status.last_sync_at).toLocaleString()}. ` : ""}
            Qai remains the source of truth.
          </p>
        </div>
      )}
    </section>
  </>;
}
