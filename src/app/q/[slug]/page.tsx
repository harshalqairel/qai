"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock3, Plus, X } from "lucide-react";

import { QaiMark } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QuestionnaireFields } from "@/features/booking-questionnaire/QuestionnaireFields";
import {
  questionsForService,
  validateQuestionnaireResponses,
  type BookingQuestion,
  type BookingQuestionFileAnswer,
  type BookingQuestionResponse,
} from "@/features/booking-questionnaire/questionnaire";
import QaiPageRenderer from "@/features/qai-page/components/QaiPageRenderer";
import {
  canShowBookedThroughQai,
  derivePublicEndTime,
  publicActionLabel,
  requiresClientServiceLocation,
  resolvePublicServiceLocation,
  snapshotPublicServiceSelection,
  QAI_ATTRIBUTION_HREF,
  validationClient,
  type InstantSlot,
  type PublicRequest,
  type PublicSchedule,
  type PublicService,
  type QaiPageConfig,
} from "@/features/qai-page/validation";
import { isValidationModeEnabled } from "@/lib/supabase/config";

type FormState = {
  submissionId: string;
  clientName: string;
  whatsapp: string;
  email: string;
  instagram: string;
  need: string;
  schedules: PublicSchedule[];
  locationChoice: "Business/studio" | "Client location";
  location: string;
  budget: string;
  notes: string;
  instantSlotId: string | null;
  questionnaireResponses: BookingQuestionResponse[];
};

function newSchedule(duration: number): PublicSchedule {
  const startTime = "09:00";
  return { id: crypto.randomUUID(), label: "", date: "", startTime, endTime: derivePublicEndTime(startTime, duration), location: "" };
}

function initialForm(service: PublicService, variantId: string | null): FormState {
  const snapshot = snapshotPublicServiceSelection(service, variantId);
  const count = service.actionMode === "Booking request" ? snapshot.defaultSessionCount : 0;
  return {
    submissionId: crypto.randomUUID(),
    clientName: "",
    whatsapp: "",
    email: "",
    instagram: "",
    need: "",
    schedules: Array.from({ length: count }, () => newSchedule(snapshot.duration)),
    locationChoice: service.locationPolicy === "Client location only" ? "Client location" : "Business/studio",
    location: "",
    budget: "",
    notes: "",
    instantSlotId: null,
    questionnaireResponses: [],
  };
}

function PoweredByQai() {
  return <a href={QAI_ATTRIBUTION_HREF} aria-label="Powered by Qai" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground hover:bg-muted"><QaiMark size="sm" tone="monochrome" decorative />Powered by Qai</a>;
}

export default function PublicQaiPage() {
  const params = useParams<{ slug: string }>();
  const [page, setPage] = useState<QaiPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ service: PublicService; variantId: string | null } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<PublicRequest | null>(null);
  const [formError, setFormError] = useState("");
  const [questionnaireErrors, setQuestionnaireErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setPage(await validationClient.page(params.slug));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This Qai Page is not available.");
    } finally {
      setLoading(false);
    }
  }, [params.slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [selected]);

  const services = useMemo(() => page?.services.filter((item) => item.visible).sort((left, right) => left.position - right.position) ?? [], [page]);
  const portfolio = useMemo(() => [...(page?.portfolio ?? [])].filter((item) => item.visible).sort((left, right) => left.position - right.position), [page]);

  function choose(service: PublicService, variantId: string | null) {
    setSelected({ service, variantId });
    setForm(initialForm(service, variantId));
    setConfirmation(null);
    setFormError("");
    setQuestionnaireErrors({});
  }

  function closeDialog() {
    if (submitting) return;
    setSelected(null);
    setForm(null);
    setConfirmation(null);
    setFormError("");
  }

  if (loading) return <main className="min-h-screen min-w-0 w-full flex-1 bg-muted p-4"><div className="mx-auto min-h-80 max-w-5xl animate-pulse rounded-2xl bg-card" /></main>;
  if (error || !page) return <main className="flex min-h-screen min-w-0 w-full flex-1 items-center justify-center bg-muted p-6"><div className="max-w-sm text-center"><h1 className="text-2xl font-bold">Page unavailable</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{error || "This Qai Page is not available."}</p></div></main>;

  return <main className="min-h-screen min-w-0 w-full max-w-none flex-1 overflow-x-hidden"><QaiPageRenderer page={page} services={services} portfolio={portfolio} onChoose={choose} />{selected && form && <PublicBookingDialog page={page} selected={selected} form={form} setForm={setForm} submitting={submitting} setSubmitting={setSubmitting} confirmation={confirmation} setConfirmation={setConfirmation} formError={formError} setFormError={setFormError} questionnaireErrors={questionnaireErrors} setQuestionnaireErrors={setQuestionnaireErrors} onReload={load} onClose={closeDialog} />}</main>;
}

function PublicBookingDialog({
  page,
  selected,
  form,
  setForm,
  submitting,
  setSubmitting,
  confirmation,
  setConfirmation,
  formError,
  setFormError,
  questionnaireErrors,
  setQuestionnaireErrors,
  onReload,
  onClose,
}: {
  page: QaiPageConfig;
  selected: { service: PublicService; variantId: string | null };
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState | null>>;
  submitting: boolean;
  setSubmitting: (value: boolean) => void;
  confirmation: PublicRequest | null;
  setConfirmation: (value: PublicRequest | null) => void;
  formError: string;
  setFormError: (value: string) => void;
  questionnaireErrors: Record<string, string>;
  setQuestionnaireErrors: (value: Record<string, string>) => void;
  onReload: () => Promise<void>;
  onClose: () => void;
}) {
  const service = selected.service;
  const snapshot = snapshotPublicServiceSelection(service, selected.variantId);
  const availableSlots = page.slots.filter((item) => item.serviceId === service.serviceId && item.status === "Available");
  const activeQuestions = questionsForService(page.questionnaire, service.serviceId);

  function change(changes: Partial<FormState>) { setForm((current) => current ? { ...current, ...changes } : current); }
  function updateSchedule(id: string, changes: Partial<PublicSchedule>) { change({ schedules: form.schedules.map((item) => item.id === id ? { ...item, ...changes } : item) }); }

  async function uploadQuestionFile(question: BookingQuestion, file: File): Promise<BookingQuestionFileAnswer> {
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type) || file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error("Use a PNG, JPG, WebP, or PDF file up to 8 MB.");
    if (isValidationModeEnabled()) {
      const uploaded = await validationClient.uploadPublicQuestionFile(file, page.slug, service.serviceId, question.id);
      return { url: uploaded.url, name: file.name, mimeType: file.type, size: file.size };
    }
    if (file.size > 2 * 1024 * 1024) throw new Error("Local file answers are limited to 2 MB.");
    const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => reject(new Error("Could not read that file.")); reader.readAsDataURL(file); });
    return { url, name: file.name, mimeType: file.type, size: file.size };
  }

  async function submit() {
    if (!form.clientName.trim()) return setFormError("Enter your name.");
    if (form.whatsapp.replace(/\D/g, "").length < 8) return setFormError("Enter a WhatsApp number we can contact.");
    if (requiresClientServiceLocation(service, form.locationChoice) && !form.location.trim()) return setFormError("Enter the service address or location.");
    if (service.actionMode === "Booking request" && form.schedules.some((item) => !item.date || !item.startTime || !item.endTime)) return setFormError("Complete every preferred schedule.");
    if (service.actionMode === "Inquiry" && !form.need.trim()) return setFormError("Tell the business what you need.");
    if (service.actionMode === "Instant booking" && !form.instantSlotId) return setFormError("Choose an available time.");
    const responseErrors = validateQuestionnaireResponses(page.questionnaire, service.serviceId, form.questionnaireResponses);
    setQuestionnaireErrors(responseErrors);
    if (Object.keys(responseErrors).length) return setFormError("Complete the required questions.");
    setSubmitting(true);
    setFormError("");
    try {
      const created = await validationClient.submitRequest({
        pageId: page.id,
        slug: page.slug,
        serviceId: service.serviceId,
        serviceName: service.title,
        serviceVariantId: selected.variantId,
        submissionId: form.submissionId,
        type: service.actionMode,
        clientName: form.clientName,
        whatsapp: form.whatsapp,
        email: form.email,
        instagram: form.instagram,
        need: form.need,
        schedules: form.schedules,
        location: resolvePublicServiceLocation(service, form.locationChoice, form.location, page.location),
        budget: form.budget,
        notes: form.notes,
        instantSlotId: form.instantSlotId,
        questionnaireResponses: form.questionnaireResponses,
      });
      setConfirmation(created);
      await onReload();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not send this request.");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="public-booking-title" className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-7 sm:py-5"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{publicActionLabel(service.actionMode)}</p><h1 id="public-booking-title" className="mt-1 truncate text-xl font-bold sm:text-2xl">{service.title}</h1></div><Button type="button" variant="ghost" size="icon" aria-label="Close booking request" disabled={submitting} onClick={onClose}><X className="size-5" /></Button></header>{confirmation ? <Confirmation request={confirmation} page={page} onClose={onClose} /> : <><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><div className="grid gap-7 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start"><div className="min-w-0 space-y-7"><section><SectionTitle>Contact details</SectionTitle><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Name"><Input autoFocus value={form.clientName} maxLength={160} autoComplete="name" onChange={(event) => change({ clientName: event.target.value })} /></Field><Field label="WhatsApp"><Input inputMode="tel" autoComplete="tel" placeholder="0812 3456 7890" value={form.whatsapp} maxLength={50} onChange={(event) => change({ whatsapp: event.target.value })} /></Field>{page.questionnaire.enabledCoreFields.includes("email") && <Field label="Email"><Input type="email" autoComplete="email" value={form.email} maxLength={160} onChange={(event) => change({ email: event.target.value })} /></Field>}{page.questionnaire.enabledCoreFields.includes("instagram") && <Field label="Instagram"><Input value={form.instagram} maxLength={200} placeholder="@username" onChange={(event) => change({ instagram: event.target.value })} /></Field>}</div></section><LocationFields page={page} service={service} form={form} change={change} />{service.actionMode === "Inquiry" && <section><SectionTitle>What do you need?</SectionTitle><div className="mt-4 space-y-4"><Textarea rows={4} maxLength={1000} value={form.need} onChange={(event) => change({ need: event.target.value })} /><Field label="Budget (optional)"><Input value={form.budget} maxLength={100} onChange={(event) => change({ budget: event.target.value })} /></Field></div></section>}{service.actionMode === "Instant booking" ? <InstantSlots slots={availableSlots} selectedId={form.instantSlotId} timezone={page.timezone} onSelect={(instantSlotId) => change({ instantSlotId })} /> : <ScheduleFields service={service} snapshotCount={snapshot.defaultSessionCount} duration={snapshot.duration} form={form} change={change} updateSchedule={updateSchedule} />}<section><SectionTitle>Extra details</SectionTitle><div className="mt-4 space-y-5">{page.questionnaire.introduction && <p className="whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">{page.questionnaire.introduction}</p>}<QuestionnaireFields questions={activeQuestions} responses={form.questionnaireResponses} errors={questionnaireErrors} publicStyle onChange={(questionnaireResponses) => { change({ questionnaireResponses }); setQuestionnaireErrors({}); }} onUploadFile={async (question, file) => { try { return await uploadQuestionFile(question, file); } catch (caught) { setFormError(caught instanceof Error ? caught.message : "Could not upload that file."); throw caught; } }} /><Field label="Notes (optional)"><Textarea rows={4} maxLength={2000} value={form.notes} onChange={(event) => change({ notes: event.target.value })} /></Field>{page.questionnaire.closing && <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{page.questionnaire.closing}</p>}</div></section><p className="rounded-xl bg-muted p-4 text-xs leading-5 text-muted-foreground">Your details will be shared privately with {page.businessName} to handle this request.</p>{formError && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{formError}</p>}</div><BookingSummary page={page} service={service} variantId={selected.variantId} form={form} /></div></div><footer className="shrink-0 border-t border-border bg-card px-5 py-4 sm:px-7"><div className="ml-auto flex max-w-md gap-3"><Button type="button" variant="outline" className="flex-1" disabled={submitting} onClick={onClose}>Cancel</Button><Button type="button" className="flex-[1.35]" disabled={submitting || (service.actionMode === "Instant booking" && availableSlots.length === 0)} onClick={() => void submit()}>{submitting ? "Sending…" : service.actionMode === "Instant booking" ? "Confirm booking" : service.actionMode === "Inquiry" ? "Send inquiry" : "Send request"}</Button></div></footer></>}</section></div>;
}

function LocationFields({ page, service, form, change }: { page: QaiPageConfig; service: PublicService; form: FormState; change: (changes: Partial<FormState>) => void }) {
  return <section><SectionTitle>Service location</SectionTitle><div className="mt-4 space-y-4">{service.locationPolicy === "Client can choose" && <div className="grid gap-2 sm:grid-cols-2">{(["Business/studio", "Client location"] as const).map((choice) => <label key={choice} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm font-semibold ${form.locationChoice === choice ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name="service-location" checked={form.locationChoice === choice} onChange={() => change({ locationChoice: choice, location: choice === "Business/studio" ? "" : form.location })} />{choice}</label>)}</div>}{(service.locationPolicy === "Client location only" || (service.locationPolicy === "Client can choose" && form.locationChoice === "Client location")) && <Field label="Service address or location"><Input value={form.location} maxLength={300} placeholder="Enter the address or location details" onChange={(event) => change({ location: event.target.value })} /></Field>}{service.locationPolicy === "Business/studio only" && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">This service takes place at {page.location || "the business location"}.</p>}{service.locationPolicy === "Online" && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">This service is delivered online.</p>}</div></section>;
}

function ScheduleFields({ service, snapshotCount, duration, form, change, updateSchedule }: { service: PublicService; snapshotCount: number; duration: number; form: FormState; change: (changes: Partial<FormState>) => void; updateSchedule: (id: string, changes: Partial<PublicSchedule>) => void }) {
  return <section><div className="flex flex-wrap items-end justify-between gap-3"><div><SectionTitle>{service.actionMode === "Booking request" ? "Preferred schedule" : "Preferred dates (optional)"}</SectionTitle><p className="mt-1 text-sm text-muted-foreground">Each date and time can be different.</p></div><Button type="button" variant="outline" size="sm" disabled={form.schedules.length >= 12} onClick={() => change({ schedules: [...form.schedules, newSchedule(duration)] })}><Plus className="size-4" />Add schedule</Button></div>{form.schedules.length === 0 ? <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">No preferred dates added.</p> : <div className="mt-4 space-y-3">{form.schedules.map((schedule, index) => <article key={schedule.id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><p className="font-semibold">Schedule {index + 1}</p>{(service.actionMode === "Inquiry" || form.schedules.length > snapshotCount) && <Button type="button" variant="ghost" size="sm" onClick={() => change({ schedules: form.schedules.filter((item) => item.id !== schedule.id) })}><X className="size-4" />Remove</Button>}</div><div className="mt-4 grid gap-4 sm:grid-cols-3"><Field label="Date"><Input type="date" value={schedule.date} onChange={(event) => updateSchedule(schedule.id, { date: event.target.value })} /></Field><Field label="Start time"><Input type="time" value={schedule.startTime} onChange={(event) => updateSchedule(schedule.id, { startTime: event.target.value })} /></Field><Field label="End time"><Input type="time" value={schedule.endTime} onChange={(event) => updateSchedule(schedule.id, { endTime: event.target.value })} /></Field></div><details className="mt-4 rounded-lg border border-border"><summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Optional schedule details</summary><div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2"><Field label="Label"><Input value={schedule.label} maxLength={100} onChange={(event) => updateSchedule(schedule.id, { label: event.target.value })} /></Field><Field label="Override location"><Input value={schedule.location} maxLength={300} placeholder="Use only if this schedule differs" onChange={(event) => updateSchedule(schedule.id, { location: event.target.value })} /></Field></div></details></article>)}</div>}</section>;
}

function InstantSlots({ slots, selectedId, timezone, onSelect }: { slots: InstantSlot[]; selectedId: string | null; timezone: string; onSelect: (id: string) => void }) {
  return <section><SectionTitle>Choose a time</SectionTitle>{slots.length === 0 ? <div className="mt-4 rounded-xl bg-muted p-4"><p className="text-sm font-semibold">No available times right now.</p><p className="mt-1 text-sm text-muted-foreground">Contact the business to request another time.</p></div> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{slots.map((slot) => <label key={slot.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${selectedId === slot.id ? "border-primary bg-primary/5" : "border-border"}`}><input type="radio" name="slot" checked={selectedId === slot.id} onChange={() => onSelect(slot.id)} /><span><span className="block font-semibold">{new Date(slot.startAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: timezone })}</span><span className="mt-1 block text-sm text-muted-foreground">{new Date(slot.startAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone })}{slot.location ? ` · ${slot.location}` : ""}</span></span></label>)}</div>}</section>;
}

function BookingSummary({ page, service, variantId, form }: { page: QaiPageConfig; service: PublicService; variantId: string | null; form: FormState }) {
  const snapshot = snapshotPublicServiceSelection(service, variantId);
  return <aside className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Request summary</p><h2 className="mt-2 text-xl font-bold">{service.title}</h2>{snapshot.variantLabel && <p className="mt-1 text-sm text-muted-foreground">{snapshot.variantLabel}</p>}<dl className="mt-5 space-y-3 border-y border-border py-4 text-sm"><div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Price</dt><dd className="text-right font-semibold">{service.priceMode === "Ask for price" ? "Ask for price" : `${service.priceMode === "Starting from" ? "From " : ""}Rp ${Math.round(snapshot.price).toLocaleString("id-ID")}`}</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Duration</dt><dd className="inline-flex items-center gap-1.5 text-right font-semibold"><Clock3 className="size-4" />{snapshot.duration} min</dd></div><div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Schedules</dt><dd className="font-semibold">{form.schedules.length || "—"}</dd></div>{page.location && <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">Business</dt><dd className="max-w-40 text-right font-semibold">{page.location}</dd></div>}</dl><p className="mt-4 text-xs leading-5 text-muted-foreground">This sends a request to {page.businessName}. It does not charge you.</p><div className="mt-5 text-center"><PoweredByQai /></div></aside>;
}

function Confirmation({ request, page, onClose }: { request: PublicRequest; page: QaiPageConfig; onClose: () => void }) {
  const schedule = request.schedules[0];
  return <div className="overflow-y-auto p-6 text-center sm:p-10"><CheckCircle2 className="mx-auto size-12 text-emerald-600" /><h2 className="mt-5 text-2xl font-bold">{request.type === "Instant booking" ? "Booking confirmed." : request.type === "Inquiry" ? "Inquiry sent." : "Request sent."}</h2>{request.type === "Instant booking" && schedule ? <div className="mx-auto mt-5 max-w-md rounded-xl bg-muted p-4"><p className="font-semibold">{request.serviceName}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(`${schedule.date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · {schedule.startTime}</p>{canShowBookedThroughQai(request) && <p className="mt-4 text-xs text-muted-foreground">Booked through Qai</p>}</div> : <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{page.businessName} will {request.type === "Inquiry" ? "get back to you" : "review your request"}.</p>}<Button className="mt-6" onClick={onClose}>Back to page</Button><div className="mt-8"><PoweredByQai /></div></div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) { return <h2 className="text-lg font-bold">{children}</h2>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-2">{label}</Label>{children}</div>; }
