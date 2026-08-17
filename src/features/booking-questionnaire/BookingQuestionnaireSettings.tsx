"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useServices } from "@/features/service/hooks/useServices";
import { notify } from "@/lib/notifications";
import {
  BOOKING_CORE_FIELDS,
  BOOKING_CORE_FIELD_LABELS,
  BOOKING_QUESTION_TYPES,
  DEFAULT_BOOKING_QUESTIONNAIRE,
  bookingQuestionSchema,
  coreFieldForQuestionLabel,
  type BookingQuestion,
  type BookingQuestionType,
  type BookingQuestionnaireDefinition,
} from "./questionnaire";
import { loadBookingQuestionnaire, saveBookingQuestionnaire } from "./questionnaireRepository";

function newQuestion(order: number): BookingQuestion {
  const now = Date.now();
  return { id: crypto.randomUUID(), label: "", helperText: "", type: "Short text", required: false, options: [], active: true, order, serviceIds: [], createdAt: now, updatedAt: now };
}

export default function BookingQuestionnaireSettings() {
  const services = useServices();
  const bookingData = useBookings();
  const [definition, setDefinition] = useState<BookingQuestionnaireDefinition>(DEFAULT_BOOKING_QUESTIONNAIRE);
  const [draft, setDraft] = useState<BookingQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const ordered = useMemo(() => [...definition.questions].sort((left, right) => left.order - right.order), [definition.questions]);

  useEffect(() => {
    let active = true;
    void loadBookingQuestionnaire().then((loaded) => { if (active) setDefinition(loaded); }).catch(() => notify.error("Could not load booking questions.")).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function persist(next: BookingQuestionnaireDefinition, message: string) {
    try { const saved = await saveBookingQuestionnaire(next); setDefinition(saved); notify.success(message); }
    catch { notify.error("Could not save the booking questionnaire."); }
  }

  async function saveQuestion() {
    if (!draft) return;
    const duplicateCoreField = coreFieldForQuestionLabel(draft.label);
    if (duplicateCoreField && definition.enabledCoreFields.includes(duplicateCoreField)) {
      return notify.error(`This information is already collected as ${BOOKING_CORE_FIELD_LABELS[duplicateCoreField]}. Configure the core field instead.`);
    }
    const parsed = bookingQuestionSchema.safeParse({ ...draft, options: draft.options.map((option) => option.trim()).filter(Boolean), updatedAt: Date.now() });
    if (!parsed.success) return notify.error(parsed.error.issues[0]?.message ?? "Check the question details.");
    const questions = definition.questions.some((question) => question.id === parsed.data.id)
      ? definition.questions.map((question) => question.id === parsed.data.id ? parsed.data : question)
      : [...definition.questions, parsed.data];
    await persist({ ...definition, questions }, "Booking question saved.");
    setDraft(null);
  }

  async function moveQuestion(question: BookingQuestion, direction: -1 | 1) {
    const index = ordered.findIndex((item) => item.id === question.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    const next = [...ordered]; [next[index], next[target]] = [next[target], next[index]];
    await persist({ ...definition, questions: next.map((item, order) => ({ ...item, order })) }, "Question order updated.");
  }

  async function removeQuestion(question: BookingQuestion) {
    const hasHistoricalAnswers = bookingData.bookings.some((booking) => booking.questionnaireResponses?.some((response) => response.questionId === question.id));
    if (hasHistoricalAnswers) {
      await persist({ ...definition, questions: definition.questions.map((item) => item.id === question.id ? { ...item, active: false, updatedAt: Date.now() } : item) }, "Historical answers were found, so the question was deactivated.");
      return;
    }
    if (!window.confirm(`Remove “${question.label}”?`)) return;
    await persist({ ...definition, questions: definition.questions.filter((item) => item.id !== question.id) }, "Booking question removed.");
  }

  if (loading) return <div className="surface-card p-6 text-sm text-muted-foreground">Loading booking questions...</div>;

  return <div className="space-y-6">
    <section className="surface-card p-5 sm:p-6">
      <div><h2 className="section-title">Booking questions</h2><p className="mt-1 text-sm text-muted-foreground">One questionnaire powers Qai Page requests, copied templates, pasted replies, and booking review.</p></div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><Label className="mb-2 block">Template introduction</Label><Textarea rows={3} value={definition.introduction} onChange={(event) => setDefinition({ ...definition, introduction: event.target.value })} /></div>
        <div className="sm:col-span-2"><Label className="mb-2 block">Template closing</Label><Textarea rows={3} value={definition.closing} onChange={(event) => setDefinition({ ...definition, closing: event.target.value })} /></div>
      </div>
      <fieldset className="mt-6"><legend className="font-semibold">Client and booking fields</legend><p className="mt-1 text-sm text-muted-foreground">Choose the structured fields included in the copyable client template.</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{BOOKING_CORE_FIELDS.map((field) => <label key={field} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm"><input type="checkbox" checked={definition.enabledCoreFields.includes(field)} onChange={(event) => setDefinition({ ...definition, enabledCoreFields: event.target.checked ? [...definition.enabledCoreFields, field] : definition.enabledCoreFields.filter((item) => item !== field) })} />{BOOKING_CORE_FIELD_LABELS[field]}</label>)}</div></fieldset>
      <Button className="mt-5" onClick={() => void persist(definition, "Booking questionnaire settings saved.")}>Save questionnaire</Button>
    </section>

    <section className="surface-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="section-title">Additional questions</h2><p className="mt-1 text-sm text-muted-foreground">Questions are private Booking data and never appear on invoices.</p></div><Button size="sm" onClick={() => setDraft(newQuestion(ordered.length))}><Plus className="size-4" /> Add question</Button></div>
      {ordered.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">No custom questions yet. Add only the details your business genuinely needs.</div> : <div className="mt-5 space-y-2">{ordered.map((question, index) => <article key={question.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-border p-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{question.label}</p><span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">{question.type}</span>{question.required && <span className="text-xs font-semibold text-primary">Required</span>}{!question.active && <span className="text-xs font-semibold text-muted-foreground">Inactive</span>}</div><p className="mt-1 truncate text-xs text-muted-foreground">{question.serviceIds.length ? `${question.serviceIds.length} selected service${question.serviceIds.length === 1 ? "" : "s"}` : "All services"}</p></div><Button size="icon-sm" variant="ghost" aria-label={`Move ${question.label} earlier`} disabled={index === 0} onClick={() => void moveQuestion(question, -1)}><ArrowUp className="size-4" /></Button><Button size="icon-sm" variant="ghost" aria-label={`Move ${question.label} later`} disabled={index === ordered.length - 1} onClick={() => void moveQuestion(question, 1)}><ArrowDown className="size-4" /></Button><Button size="icon-sm" variant="ghost" aria-label={`Edit ${question.label}`} onClick={() => setDraft(question)}><Pencil className="size-4" /></Button><Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`Remove ${question.label}`} onClick={() => void removeQuestion(question)}><Trash2 className="size-4" /></Button></article>)}</div>}
    </section>

    {draft && <section className="surface-card p-5 sm:p-6" aria-labelledby="question-editor-heading"><div className="flex items-center justify-between gap-3"><h2 id="question-editor-heading" className="section-title">{definition.questions.some((item) => item.id === draft.id) ? "Edit question" : "New question"}</h2><Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button></div><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <div><Label className="mb-2 block">Label</Label><Input value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} /></div>
      <div><Label className="mb-2 block">Type</Label><select className="native-control" value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as BookingQuestionType, options: ["Single choice", "Multiple choice"].includes(event.target.value) ? draft.options : [] })}>{BOOKING_QUESTION_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
      <div className="sm:col-span-2"><Label className="mb-2 block">Helper text <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea rows={2} value={draft.helperText} onChange={(event) => setDraft({ ...draft, helperText: event.target.value })} /></div>
      {["Single choice", "Multiple choice"].includes(draft.type) && <div className="sm:col-span-2"><Label className="mb-2 block">Choices <span className="font-normal text-muted-foreground">(one per line)</span></Label><Textarea rows={5} value={draft.options.join("\n")} onChange={(event) => setDraft({ ...draft, options: event.target.value.split(/\r?\n/) })} /></div>}
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={draft.required} onChange={(event) => setDraft({ ...draft, required: event.target.checked })} /> <span className="text-sm font-semibold">Required</span></label>
      <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> <span className="text-sm font-semibold">Active</span></label>
      <fieldset className="sm:col-span-2"><legend className="font-semibold">Services</legend><p className="mt-1 text-sm text-muted-foreground">Leave every service unchecked to ask this for all services.</p><div className="mt-3 grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">{services.services.filter((service) => service.active).map((service) => <label key={service.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-border px-3 text-sm"><input type="checkbox" checked={draft.serviceIds.includes(service.id)} onChange={(event) => setDraft({ ...draft, serviceIds: event.target.checked ? [...draft.serviceIds, service.id] : draft.serviceIds.filter((id) => id !== service.id) })} />{service.name}</label>)}</div></fieldset>
    </div><Button className="mt-5" onClick={() => void saveQuestion()}>Save question</Button></section>}
  </div>;
}
