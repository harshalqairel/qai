"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarCheck2,
  ExternalLink,
  LoaderCircle,
  MoreHorizontal,
  RefreshCw,
  RotateCw,
  Unplug,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/notifications";
import { isCloudModeEnabled, isValidationModeEnabled } from "@/lib/supabase/config";

type Status = {
  configured: boolean;
  status: "unavailable" | "disconnected" | "connected" | "error" | "reconnect_required";
  googleAccount: string | null;
  targetCalendarId: string | null;
  lastSyncAt: string | null;
  lastSyncAttemptAt: string | null;
  lastError: string | null;
  calendars: Array<{ id: string; name: string; primary: boolean }>;
};

type ApiResult<T> = { data?: T; error?: string };

function timeLabel(value: string | null): string {
  if (!value) return "Not synced yet";
  return `Last synced ${new Date(value).toLocaleString()}`;
}

export default function GoogleCalendarSyncCard() {
  const enabled = isCloudModeEnabled() || isValidationModeEnabled();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "sync" | "select" | "disconnect" | null>(
    enabled ? "load" : null,
  );

  const load = useCallback(async () => {
    if (!enabled) return;
    setBusy((current) => current ?? "load");
    setLoadError(null);
    try {
      const response = await fetch("/api/integrations/google-calendar", { cache: "no-store" });
      const result = await response.json() as ApiResult<Status>;
      if (!response.ok || !result.data) throw new Error(result.error || "Google Calendar settings are unavailable.");
      setStatus(result.data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google Calendar settings are unavailable.";
      setLoadError(message);
      notify.error(message);
    } finally {
      setBusy(null);
    }
  }, [enabled]);

  useEffect(() => {
    const loadTimeout = window.setTimeout(() => { void load(); }, 0);
    const url = new URL(window.location.href);
    const query = url.searchParams.get("calendar");
    if (query === "connected") notify.success("Google Calendar connected.");
    else if (query === "cancelled") notify.info("Google Calendar connection was cancelled.");
    else if (query === "account-mismatch") notify.error("Reconnect the same Google account while synced schedules still exist.");
    else if (query === "error" || query === "not-configured") notify.error("Google Calendar could not be connected.");
    if (query) {
      url.searchParams.delete("calendar");
      window.history.replaceState(window.history.state, "", url);
    }
    return () => window.clearTimeout(loadTimeout);
  }, [load]);

  if (!enabled) return null;

  async function select(calendarId: string) {
    setBusy("select");
    try {
      const response = await fetch("/api/integrations/google-calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId }),
      });
      const result = await response.json() as ApiResult<{ ok: boolean }>;
      if (!response.ok) throw new Error(result.error || "Could not select that calendar.");
      await load();
      notify.success("Google Calendar updated. Sync now to reconcile schedules.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not select that calendar.");
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    setBusy("sync");
    try {
      const response = await fetch("/api/integrations/google-calendar/sync", { method: "POST" });
      const result = await response.json() as ApiResult<Record<string, number>>;
      if (!response.ok || !result.data) throw new Error(result.error || "Some schedules could not be synced.");
      await load();
      const changed = (result.data.created ?? 0) + (result.data.updated ?? 0) + (result.data.deleted ?? 0);
      notify.success(changed
        ? `Google Calendar synced · ${changed} changes.`
        : "Google Calendar is already up to date.");
    } catch (error) {
      await load();
      notify.error(error instanceof Error ? error.message : "Google Calendar could not be synced.");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar? Existing Qai-created events will remain in Google Calendar.")) return;
    setBusy("disconnect");
    try {
      const response = await fetch("/api/integrations/google-calendar", { method: "DELETE" });
      const result = await response.json() as ApiResult<{ ok: boolean }>;
      if (!response.ok) throw new Error(result.error || "Could not disconnect Google Calendar.");
      await load();
      notify.success("Google Calendar disconnected. Existing events were left unchanged.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not disconnect Google Calendar.");
    } finally {
      setBusy(null);
    }
  }

  const manageable = status?.status === "connected" || status?.status === "error";
  const reconnectRequired = status?.status === "reconnect_required";
  const destination = status?.calendars.find((calendar) => calendar.id === status.targetCalendarId);
  const statusLabel = status?.status === "connected"
    ? "Connected"
    : status?.status === "error"
      ? "Try again"
      : reconnectRequired
        ? "Reconnect required"
        : "Not connected";

  return (
    <section className="surface-card overflow-hidden" aria-labelledby="google-calendar-heading">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarCheck2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="google-calendar-heading" className="font-semibold">Google Calendar</h2>
              {status && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  status.status === "connected"
                    ? "bg-emerald-50 text-emerald-700"
                    : status.status === "error" || reconnectRequired
                      ? "bg-amber-50 text-amber-800"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {statusLabel}
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {manageable || reconnectRequired
                ? status?.googleAccount || "Connected Google account"
                : "Send Qai schedules to a calendar you choose."}
            </p>
          </div>
        </div>

        {busy === "load" ? (
          <LoaderCircle className="size-5 animate-spin self-center text-muted-foreground" aria-label="Loading Calendar connection" />
        ) : !status ? (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className="max-w-sm text-sm text-destructive" role="alert">
              {loadError || "Google Calendar settings are unavailable."}
            </p>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="size-4" aria-hidden="true" /> Retry
            </Button>
          </div>
        ) : !status.configured ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Not configured for this deployment</p>
        ) : !manageable ? (
          <Button render={<a href="/api/integrations/google-calendar/connect" />}>
            <ExternalLink className="size-4" aria-hidden="true" />
            {reconnectRequired ? "Reconnect" : "Connect"}
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
                <DropdownMenuItem render={<a href="/api/integrations/google-calendar/connect" />}>
                  <RotateCw className="size-4" aria-hidden="true" /> Reconnect
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" disabled={busy !== null} onClick={() => void disconnect()}>
                  <Unplug className="size-4" aria-hidden="true" /> Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {manageable && (
        <div className="grid gap-4 border-t border-border bg-slate-50/70 px-4 py-4 sm:grid-cols-[minmax(0,22rem)_1fr] sm:items-end sm:px-5">
          <div>
            <Label htmlFor="target-google-calendar">Send schedules to</Label>
            <select
              id="target-google-calendar"
              className="native-control mt-2"
              value={status.targetCalendarId ?? ""}
              disabled={busy !== null}
              onChange={(event) => void select(event.target.value)}
            >
              {!destination && status.targetCalendarId && (
                <option value={status.targetCalendarId}>Previously selected calendar (unavailable)</option>
              )}
              {status.calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.name}{calendar.primary ? " (Primary)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs leading-5 text-muted-foreground sm:text-right">
            <p>{timeLabel(status.lastSyncAt)}</p>
            {status.lastError && <p className="mt-1 font-medium text-amber-800">{status.lastError}</p>}
            {!status.lastError && status.lastSyncAttemptAt && !status.lastSyncAt && (
              <p className="mt-1">A sync has been attempted but not completed.</p>
            )}
            <p className="mt-1">Qai remains the source of truth.</p>
          </div>
        </div>
      )}
    </section>
  );
}
