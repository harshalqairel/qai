/* eslint-disable @next/next/no-img-element, react/no-unescaped-entities -- Validation-only owner-provided data URLs cannot use the Next image optimizer. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, AtSign, CheckCircle2, Mail, MapPin, MessageCircle, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  canShowBookedThroughQai,
  publicActionLabel,
  publicPriceLabel,
  validationClient,
  type PublicRequest,
  type PublicSchedule,
  type PublicService,
  type QaiPageConfig,
} from "@/features/qai-page/validation";

type FormState = {
  clientName: string; whatsapp: string; email: string; need: string; schedules: PublicSchedule[]; location: string; budget: string; notes: string; instantSlotId: string | null;
};

const Instagram = AtSign;

function newSchedule(): PublicSchedule { return { id: crypto.randomUUID(), label: "", date: "", startTime: "09:00", endTime: "10:00", location: "" }; }
function initialForm(mode: PublicService["actionMode"]): FormState { return { clientName: "", whatsapp: "", email: "", need: "", schedules: mode === "Booking request" ? [newSchedule()] : [], location: "", budget: "", notes: "", instantSlotId: null }; }

export default function PublicQaiPage() {
  const params = useParams<{ slug: string }>(); const slug = params.slug;
  const [page, setPage] = useState<QaiPageConfig | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [selected, setSelected] = useState<PublicService | null>(null); const [form, setForm] = useState<FormState>(initialForm("Booking request"));
  const [submitting, setSubmitting] = useState(false); const [confirmation, setConfirmation] = useState<PublicRequest | null>(null); const [formError, setFormError] = useState("");
  const load = useCallback(async () => { try { setPage(await validationClient.page(slug)); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "This Qai Page is not available."); } finally { setLoading(false); } }, [slug]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const services = useMemo(() => page?.services.filter((item) => item.visible) ?? [], [page]);
  const availableSlots = useMemo(() => page?.slots.filter((item) => item.serviceId === selected?.serviceId && item.status === "Available") ?? [], [page, selected]);
  function choose(service: PublicService) { setSelected(service); setForm(initialForm(service.actionMode)); setConfirmation(null); setFormError(""); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function updateSchedule(id: string, changes: Partial<PublicSchedule>) { setForm({ ...form, schedules: form.schedules.map((item) => item.id === id ? { ...item, ...changes } : item) }); }
  async function submit() {
    if (!page || !selected) return;
    if (!form.clientName.trim()) return setFormError("Enter your name.");
    if (form.whatsapp.replace(/\D/g, "").length < 8) return setFormError("Enter a WhatsApp number we can contact.");
    if (selected.actionMode === "Booking request" && form.schedules.some((item) => !item.date || !item.startTime || !item.endTime)) return setFormError("Complete every preferred schedule.");
    if (selected.actionMode === "Inquiry" && !form.need.trim()) return setFormError("Tell the business what you need.");
    if (selected.actionMode === "Instant booking" && !form.instantSlotId) return setFormError("Choose an available time.");
    setSubmitting(true); setFormError("");
    try {
      const created = await validationClient.submitRequest({ pageId: page.id, slug: page.slug, serviceId: selected.serviceId, serviceName: selected.title, type: selected.actionMode,
        clientName: form.clientName, whatsapp: form.whatsapp, email: form.email, need: form.need, schedules: form.schedules, location: form.location,
        budget: form.budget, notes: form.notes, instantSlotId: form.instantSlotId });
      setConfirmation(created); await load();
    } catch (caught) { setFormError(caught instanceof Error ? caught.message : "Could not send this request."); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className="min-h-screen bg-[#f7f8f5] p-4"><div className="mx-auto min-h-80 max-w-3xl animate-pulse rounded-2xl bg-white" /></main>;
  if (error || !page) return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] p-6"><div className="max-w-sm text-center"><h1 className="text-2xl font-bold text-[#17272a]">Page unavailable</h1><p className="mt-3 text-sm leading-6 text-[#66726f]">{error || "This Qai Page is not available."}</p></div></main>;
  if (confirmation) {
    const schedule = confirmation.schedules[0];
    return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] p-4 text-[#17272a]"><article className="w-full max-w-md rounded-2xl border border-[#dde3dd] bg-white p-6 text-center shadow-sm sm:p-8"><CheckCircle2 className="mx-auto size-11 text-[#356f6b]" aria-hidden="true" /><h1 className="mt-5 text-2xl font-bold">{confirmation.type === "Instant booking" ? "Booking confirmed." : confirmation.type === "Inquiry" ? "Inquiry sent." : "Request sent."}</h1>{confirmation.type === "Instant booking" && schedule ? <div className="mt-5 rounded-xl bg-[#eef1ec] p-4"><p className="font-semibold">{confirmation.serviceName}</p><p className="mt-1 text-sm text-[#66726f]">{new Date(`${schedule.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {schedule.startTime}</p>{canShowBookedThroughQai(confirmation) && <p className="mt-4 text-xs text-[#66726f]">Booked through Qai</p>}</div> : <p className="mt-3 text-sm leading-6 text-[#66726f]">{page.businessName} will {confirmation.type === "Inquiry" ? "get back to you" : "review your request"}.</p>}<Button className="mt-6 w-full" variant="outline" onClick={() => { setConfirmation(null); setSelected(null); }}>Back to services</Button><p className="mt-8 text-xs text-[#8a9692]">Powered by Qai</p></article></main>;
  }

  return <main className="min-h-screen overflow-x-hidden bg-[#f7f8f5] text-[#17272a]">
    {!selected ? <>
      {page.coverImage && <div className="h-40 w-full overflow-hidden bg-[#eef1ec] sm:h-56"><img src={page.coverImage} alt="" className="h-full w-full object-cover" /></div>}
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <header className={`flex flex-col gap-5 ${page.coverImage ? "-mt-20 relative rounded-2xl border border-[#dde3dd] bg-white p-6 shadow-sm sm:p-8" : ""}`}>
          {page.logo && <img src={page.logo} alt={`${page.businessName} logo`} className="size-20 rounded-2xl border border-[#dde3dd] bg-white object-cover p-1" />}
          <div><h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">{page.businessName}</h1>{page.shortDescription && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-base leading-7 text-[#66726f]">{page.shortDescription}</p>}{page.location && <p className="mt-3 flex items-center gap-2 text-sm text-[#66726f]"><MapPin className="size-4" /> {page.location}</p>}</div>
          {(page.whatsapp || page.email || page.instagram) && <div className="flex flex-wrap gap-2">{page.whatsapp && <span className="inline-flex items-center gap-2 rounded-full bg-[#eef1ec] px-3 py-2 text-sm"><MessageCircle className="size-4" /> WhatsApp available</span>}{page.email && <span className="inline-flex items-center gap-2 rounded-full bg-[#eef1ec] px-3 py-2 text-sm"><Mail className="size-4" /> Email available</span>}{page.instagram && <span className="inline-flex items-center gap-2 rounded-full bg-[#eef1ec] px-3 py-2 text-sm"><Instagram className="size-4" /> Social profile</span>}</div>}
        </header>
        <section className="mt-10"><h2 className="text-xl font-bold">Services</h2>{services.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-[#cfd8d2] bg-white p-8 text-center"><p className="font-semibold">This business hasn't added any public services yet.</p></div> : <div className="mt-4 grid gap-4 sm:grid-cols-2">{services.map((service) => <article key={service.serviceId} className="flex flex-col rounded-2xl border border-[#dde3dd] bg-white p-5 shadow-sm sm:p-6"><h3 className="break-words text-lg font-bold">{service.title}</h3>{service.description && <p className="mt-2 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#66726f]">{service.description}</p>}<p className="mt-5 font-semibold text-[#356f6b]">{publicPriceLabel(service)}</p><Button className="mt-5 w-full" onClick={() => choose(service)}>{publicActionLabel(service.actionMode)}</Button></article>)}</div>}</section>
        <footer className="pt-14 text-center text-xs text-[#8a9692]">Powered by Qai</footer>
      </div>
    </> : <div className="mx-auto w-full max-w-2xl px-4 py-5 sm:px-6 sm:py-10">
      <button type="button" onClick={() => setSelected(null)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#356f6b] hover:bg-[#eef1ec]"><ArrowLeft className="size-4" /> Back to services</button>
      <section className="mt-3 rounded-2xl border border-[#dde3dd] bg-white p-5 shadow-sm sm:p-8"><header><p className="text-sm font-semibold text-[#356f6b]">{selected.actionMode}</p><h1 className="mt-2 break-words text-2xl font-bold">{selected.title}</h1><p className="mt-2 font-semibold">{publicPriceLabel(selected)}</p></header>
        <div className="mt-7 space-y-5"><div className="grid gap-5 sm:grid-cols-2"><Field label="Name"><Input value={form.clientName} maxLength={160} onChange={(event) => setForm({ ...form, clientName: event.target.value })} /></Field><Field label="WhatsApp"><Input inputMode="tel" placeholder="0812 3456 7890" value={form.whatsapp} maxLength={50} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} /></Field><Field label="Email (optional)"><Input type="email" value={form.email} maxLength={160} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field><Field label="Location (optional)"><Input value={form.location} maxLength={300} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field></div>
          {selected.actionMode === "Inquiry" && <><Field label="What do you need?"><Textarea rows={4} maxLength={1000} value={form.need} onChange={(event) => setForm({ ...form, need: event.target.value })} /></Field><Field label="Budget (optional)"><Input value={form.budget} maxLength={100} onChange={(event) => setForm({ ...form, budget: event.target.value })} /></Field></>}
          {selected.actionMode === "Instant booking" && <section><h2 className="font-semibold">Choose a time</h2>{availableSlots.length === 0 ? <div className="mt-3 rounded-xl bg-[#eef1ec] p-4"><p className="text-sm font-semibold">No available times right now.</p><p className="mt-1 text-sm text-[#66726f]">Request another time by contacting {page.businessName}.</p></div> : <div className="mt-3 grid gap-2 sm:grid-cols-2">{availableSlots.map((slot) => <label key={slot.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${form.instantSlotId === slot.id ? "border-[#356f6b] bg-[#e3eeeb]" : "border-[#dde3dd]"}`}><input type="radio" name="slot" value={slot.id} checked={form.instantSlotId === slot.id} onChange={() => setForm({ ...form, instantSlotId: slot.id })} /><span><span className="block font-semibold">{new Date(slot.startAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: page.timezone })}</span><span className="mt-1 block text-sm text-[#66726f]">{new Date(slot.startAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: page.timezone })}{slot.location ? ` · ${slot.location}` : ""}</span></span></label>)}</div>}</section>}
          {selected.actionMode !== "Instant booking" && <section><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{selected.actionMode === "Booking request" ? "Preferred schedules" : "Preferred dates (optional)"}</h2><Button variant="outline" size="sm" onClick={() => setForm({ ...form, schedules: [...form.schedules, newSchedule()] })} disabled={form.schedules.length >= 12}><Plus className="size-4" /> Add schedule</Button></div>{form.schedules.length === 0 ? <p className="mt-3 text-sm text-[#66726f]">No preferred dates added.</p> : <div className="mt-3 space-y-3">{form.schedules.map((schedule, index) => <article key={schedule.id} className="rounded-xl border border-[#dde3dd] p-4"><div className="flex items-center justify-between"><p className="font-semibold">Schedule {index + 1}</p>{(selected.actionMode === "Inquiry" || form.schedules.length > 1) && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, schedules: form.schedules.filter((item) => item.id !== schedule.id) })}><X className="size-4" /> Remove</Button>}</div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Label (optional)"><Input value={schedule.label} maxLength={100} onChange={(event) => updateSchedule(schedule.id, { label: event.target.value })} /></Field><Field label="Date"><Input type="date" value={schedule.date} onChange={(event) => updateSchedule(schedule.id, { date: event.target.value })} /></Field><Field label="Start time"><Input type="time" value={schedule.startTime} onChange={(event) => updateSchedule(schedule.id, { startTime: event.target.value })} /></Field><Field label="End time"><Input type="time" value={schedule.endTime} onChange={(event) => updateSchedule(schedule.id, { endTime: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Location (optional)"><Input value={schedule.location} maxLength={300} onChange={(event) => updateSchedule(schedule.id, { location: event.target.value })} /></Field></div></div></article>)}</div>}</section>}
          <Field label="Notes (optional)"><Textarea rows={4} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
          <p className="rounded-xl bg-[#eef1ec] p-4 text-xs leading-5 text-[#66726f]">Your details will be shared with {page.businessName} to handle this request.</p>{formError && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{formError}</p>}<Button className="w-full" size="lg" disabled={submitting || (selected.actionMode === "Instant booking" && availableSlots.length === 0)} onClick={() => void submit()}>{submitting ? "Sending…" : selected.actionMode === "Instant booking" ? "Confirm booking" : selected.actionMode === "Inquiry" ? "Send inquiry" : "Send request"}</Button>
        </div>
      </section><footer className="py-8 text-center text-xs text-[#8a9692]">Powered by Qai</footer>
    </div>}
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-2 text-[#17272a]">{label}</Label>{children}</div>; }
