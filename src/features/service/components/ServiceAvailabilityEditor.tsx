"use client";

import { Copy, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WEEKDAYS, normalizeServiceAvailability } from "@/features/service/domain/serviceAvailability";
import type { ServiceAvailability } from "@/features/service/types";

type Props = { value?: ServiceAvailability; onChange: (value: ServiceAvailability) => void };

function newId() { return crypto.randomUUID(); }

export default function ServiceAvailabilityEditor({ value, onChange }: Props) {
  const availability = normalizeServiceAvailability(value);
  const multiple = availability.capacityMode === "Multiple bookings";

  function change(patch: Partial<ServiceAvailability>) { onChange({ ...availability, ...patch }); }
  function addRecurring(weekday: number) {
    change({ recurringTimes: [...availability.recurringTimes, { id: newId(), weekday, startTime: "10:00", capacity: null, manualBlocked: 0 }] });
  }
  function copyMonday() {
    const monday = availability.recurringTimes.filter((slot) => slot.weekday === 0);
    if (!monday.length) return;
    change({ recurringTimes: [
      ...availability.recurringTimes.filter((slot) => slot.weekday === 0),
      ...WEEKDAYS.slice(1).flatMap((_, weekdayIndex) => monday.map((slot) => ({ ...slot, id: newId(), weekday: weekdayIndex + 1 }))),
    ] });
  }
  function addDated() {
    const date = new Date(); date.setDate(date.getDate() + 7);
    change({ datedSessions: [...availability.datedSessions, { id: newId(), date: date.toISOString().slice(0, 10), startTime: "10:00", endTime: "11:00", location: "", capacity: null, manualBlocked: 0, active: true }] });
  }
  function addOverride() {
    const date = new Date(); date.setDate(date.getDate() + 7);
    change({ overrides: [...availability.overrides, { id: newId(), date: date.toISOString().slice(0, 10), startTime: "10:00", capacity: null, manualBlocked: 0, unavailable: false }] });
  }

  return <section className="space-y-5 rounded-xl border border-border p-4 sm:p-5" aria-labelledby="service-booking-times-heading">
    <div><h3 id="service-booking-times-heading" className="font-semibold">Booking times</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">Control whether clients suggest a time or choose only times you offer.</p></div>
    <div className="grid gap-2 sm:grid-cols-3">
      {(["Flexible", "Recurring times", "Dated sessions"] as const).map((mode) => <button key={mode} type="button" aria-pressed={availability.mode === mode} onClick={() => change({ mode })} className="min-h-12 rounded-xl border border-border px-3 py-2 text-left text-sm font-semibold transition aria-pressed:border-primary aria-pressed:bg-primary/8"><span className="block">{mode === "Flexible" ? "Flexible time" : mode === "Recurring times" ? "Specific times" : "Dated sessions"}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{mode === "Flexible" ? "Client suggests a schedule" : mode === "Recurring times" ? "Repeat by weekday" : "Individual dates and times"}</span></button>)}
    </div>

    {availability.mode !== "Flexible" && <>
      <fieldset><legend className="text-sm font-semibold">Capacity</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{(["One booking", "Multiple bookings"] as const).map((mode) => <label key={mode} className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-sm font-medium"><input type="radio" checked={availability.capacityMode === mode} onChange={() => change({ capacityMode: mode, defaultCapacity: mode === "One booking" ? 1 : Math.max(2, availability.defaultCapacity) })} />{mode === "One booking" ? "One booking per time" : "Allow multiple bookings"}</label>)}</div></fieldset>
      {multiple && <div className="max-w-48"><Label className="mb-2 block">Default maximum bookings</Label><EditableNumberInput min={1} max={10000} inputMode="numeric" value={availability.defaultCapacity} onValueChange={(defaultCapacity) => change({ defaultCapacity: Math.max(1, defaultCapacity) })} /></div>}
    </>}

    {availability.mode === "Recurring times" && <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold">Weekly times</h4><p className="text-xs text-muted-foreground">Add different start times for each weekday.</p></div><Button type="button" variant="outline" size="sm" disabled={!availability.recurringTimes.some((slot) => slot.weekday === 0)} onClick={copyMonday}><Copy className="size-4" />Copy Monday to all days</Button></div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {WEEKDAYS.map((day, weekday) => { const slots = availability.recurringTimes.filter((slot) => slot.weekday === weekday).sort((a, b) => a.startTime.localeCompare(b.startTime)); return <div key={day} className="grid gap-3 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]"><div className="flex items-center justify-between sm:block"><p className="text-sm font-semibold">{day}</p><Button type="button" variant="ghost" size="sm" onClick={() => addRecurring(weekday)}><Plus className="size-4" />Add time</Button></div><div className="space-y-2">{slots.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Not offered</p> : slots.map((slot) => <div key={slot.id} className={`grid items-end gap-2 ${multiple ? "grid-cols-2 sm:grid-cols-[1fr_5.5rem_6.75rem_auto]" : "grid-cols-[1fr_auto]"}`}><div><Label className="mb-1 block text-xs">Start</Label><Input type="time" value={slot.startTime} onChange={(event) => change({ recurringTimes: availability.recurringTimes.map((item) => item.id === slot.id ? { ...item, startTime: event.target.value } : item) })} /></div>{multiple && <><div><Label className="mb-1 block text-xs">Max</Label><EditableNumberInput min={1} emptyValue={availability.defaultCapacity} value={slot.capacity ?? availability.defaultCapacity} onValueChange={(capacity) => change({ recurringTimes: availability.recurringTimes.map((item) => item.id === slot.id ? { ...item, capacity: Math.max(1, capacity) } : item) })} /></div><div><Label className="mb-1 block text-xs">Reserved spots</Label><EditableNumberInput min={0} value={slot.manualBlocked} onValueChange={(manualBlocked) => change({ recurringTimes: availability.recurringTimes.map((item) => item.id === slot.id ? { ...item, manualBlocked: Math.max(0, manualBlocked) } : item) })} /></div></>}<Button type="button" variant="ghost" size="icon" aria-label={`Remove ${day} ${slot.startTime}`} onClick={() => change({ recurringTimes: availability.recurringTimes.filter((item) => item.id !== slot.id) })}><Trash2 className="size-4" /></Button></div>)}</div></div>; })}
      </div>
      <div className="rounded-xl bg-muted/40 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Adjust one date</p><p className="text-xs text-muted-foreground">Close a recurring time or reserve spots for one occurrence.</p></div><Button type="button" variant="outline" size="sm" onClick={addOverride}><Plus className="size-4" />Add adjustment</Button></div>{availability.overrides.length > 0 && <div className="mt-3 space-y-2">{availability.overrides.map((override) => <div key={override.id} className="grid gap-2 sm:grid-cols-[1fr_7rem_7rem_auto_auto] sm:items-end"><Input type="date" aria-label="Adjustment date" value={override.date} onChange={(event) => change({ overrides: availability.overrides.map((item) => item.id === override.id ? { ...item, date: event.target.value } : item) })} /><Input type="time" aria-label="Adjustment time" value={override.startTime} onChange={(event) => change({ overrides: availability.overrides.map((item) => item.id === override.id ? { ...item, startTime: event.target.value } : item) })} />{multiple && <div><Label className="mb-1 block text-xs">Reserved spots</Label><EditableNumberInput aria-label="Reserved spots" min={0} value={override.manualBlocked} onValueChange={(manualBlocked) => change({ overrides: availability.overrides.map((item) => item.id === override.id ? { ...item, manualBlocked: Math.max(0, manualBlocked) } : item) })} /></div>}<label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={override.unavailable} onChange={(event) => change({ overrides: availability.overrides.map((item) => item.id === override.id ? { ...item, unavailable: event.target.checked } : item) })} />Closed</label><Button type="button" variant="ghost" size="icon" aria-label="Remove date adjustment" onClick={() => change({ overrides: availability.overrides.filter((item) => item.id !== override.id) })}><Trash2 className="size-4" /></Button></div>)}</div>}</div>
    </div>}

    {availability.mode === "Dated sessions" && <div><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-semibold">Dated sessions</h4><p className="text-xs text-muted-foreground">Create the exact dates clients can choose.</p></div><Button type="button" variant="outline" size="sm" onClick={addDated}><Plus className="size-4" />Add session</Button></div><div className="mt-3 space-y-3">{availability.datedSessions.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">No dated sessions yet.</p> : availability.datedSessions.map((slot) => <div key={slot.id} className="rounded-xl border border-border p-3"><div className="grid gap-3 sm:grid-cols-3"><div><Label className="mb-1 block text-xs">Date</Label><Input type="date" value={slot.date} onChange={(event) => change({ datedSessions: availability.datedSessions.map((item) => item.id === slot.id ? { ...item, date: event.target.value } : item) })} /></div><div><Label className="mb-1 block text-xs">Start</Label><Input type="time" value={slot.startTime} onChange={(event) => change({ datedSessions: availability.datedSessions.map((item) => item.id === slot.id ? { ...item, startTime: event.target.value } : item) })} /></div><div><Label className="mb-1 block text-xs">End</Label><Input type="time" value={slot.endTime} onChange={(event) => change({ datedSessions: availability.datedSessions.map((item) => item.id === slot.id ? { ...item, endTime: event.target.value } : item) })} /></div><div className="sm:col-span-3"><Label className="mb-1 block text-xs">Location</Label><Input value={slot.location} onChange={(event) => change({ datedSessions: availability.datedSessions.map((item) => item.id === slot.id ? { ...item, location: event.target.value } : item) })} /></div>{multiple && <><div><Label className="mb-1 block text-xs">Maximum bookings</Label><EditableNumberInput min={1} value={slot.capacity ?? availability.defaultCapacity} onValueChange={(capacity) => change({ datedSessions: availability.datedSessions.map((item) => item.id === slot.id ? { ...item, capacity: Math.max(1, capacity) } : item) })} /></div><div><Label className="mb-1 block text-xs">Reserved spots</Label><EditableNumberInput min={0} value={slot.manualBlocked} onValueChange={(manualBlocked) => change({ datedSessions: availability.datedSessions.map((item) => item.id === slot.id ? { ...item, manualBlocked: Math.max(0, manualBlocked) } : item) })} /><p className="mt-1 text-xs text-muted-foreground">Spots you want to keep unavailable for booking.</p></div></>}<label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={slot.active} onChange={(event) => change({ datedSessions: availability.datedSessions.map((item) => item.id === slot.id ? { ...item, active: event.target.checked } : item) })} />Open for booking</label></div><div className="mt-2 flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={() => change({ datedSessions: availability.datedSessions.filter((item) => item.id !== slot.id) })}><Trash2 className="size-4" />Remove</Button></div></div>)}</div></div>}

    {availability.mode === "Flexible" && <p className="rounded-xl bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">Clients will continue using Qai’s existing preferred-schedule form. Capacity is not applied to flexible times.</p>}
  </section>;
}
