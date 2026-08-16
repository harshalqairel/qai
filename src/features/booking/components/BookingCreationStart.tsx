"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Clipboard, ClipboardPaste, FilePenLine, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/features/customer/types";
import type { Service } from "@/features/service/types";
import {
  BOOKING_TEMPLATE_FIELDS,
  formatBookingClientTemplate,
  matchExistingCustomer,
  matchExistingService,
  parseBookingText,
  type BookingTemplateField,
  type ParsedBookingText,
} from "@/features/booking/domain/bookingText";
import { BOOKING_CORE_FIELD_LABELS, DEFAULT_BOOKING_QUESTIONNAIRE, type BookingQuestionnaireDefinition } from "@/features/booking-questionnaire/questionnaire";
import { getBookingQuestionnaire, loadBookingQuestionnaire, saveBookingQuestionnaire } from "@/features/booking-questionnaire/questionnaireRepository";
import { HistoricalQuestionnaireResponses } from "@/features/booking-questionnaire/QuestionnaireFields";
import { notify } from "@/lib/notifications";

type StartMode = "choose" | "paste" | "template";
type ParsedReview = {
  parsed: ParsedBookingText;
  customerId: string;
  serviceId: string;
};

type BookingCreationStartProps = {
  mode: StartMode;
  customers: Customer[];
  services: Service[];
  onModeChange: (mode: StartMode | "manual") => void;
  onReview: (review: ParsedReview) => void;
};

export default function BookingCreationStart({ mode, customers, services, onModeChange, onReview }: BookingCreationStartProps) {
  const [source, setSource] = useState("");
  const [parsed, setParsed] = useState<ParsedBookingText | null>(null);
  const [customerChoice, setCustomerChoice] = useState("");
  const [serviceChoice, setServiceChoice] = useState("");
  const [preferences, setPreferences] = useState<BookingQuestionnaireDefinition>(() => typeof window === "undefined" ? structuredClone(DEFAULT_BOOKING_QUESTIONNAIRE) : getBookingQuestionnaire());
  const saveTimer = useRef<number | null>(null);
  const pendingPreferences = useRef<BookingQuestionnaireDefinition | null>(null);
  const customerMatch = useMemo(() => parsed ? matchExistingCustomer(parsed, customers) : null, [parsed, customers]);
  const serviceMatch = useMemo(() => parsed ? matchExistingService(parsed.service, services) : null, [parsed, services]);
  const template = useMemo(() => formatBookingClientTemplate("Qai", preferences), [preferences]);
  const orderedFields = [...preferences.enabledCoreFields, ...BOOKING_TEMPLATE_FIELDS.filter((field) => !preferences.enabledCoreFields.includes(field))];

  useEffect(() => { let active = true; void loadBookingQuestionnaire().then((loaded) => { if (active) setPreferences(loaded); }).catch(() => undefined); return () => { active = false; if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); if (pendingPreferences.current) void saveBookingQuestionnaire(pendingPreferences.current).catch(() => undefined); }; }, []);

  function parse() {
    if (!source.trim()) return notify.error("Paste the completed booking text first.");
    const result = parseBookingText(source, preferences.questions);
    const nextCustomer = matchExistingCustomer(result, customers);
    const nextService = matchExistingService(result.service, services);
    setParsed(result);
    setCustomerChoice(nextCustomer.kind === "exact" ? nextCustomer.matches[0].id : "");
    setServiceChoice(nextService.kind === "exact" ? nextService.matches[0].id : "");
  }

  function savePreferences(next: BookingQuestionnaireDefinition) {
    setPreferences(next);
    pendingPreferences.current = next;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const pending = pendingPreferences.current;
      pendingPreferences.current = null;
      saveTimer.current = null;
      if (pending) void saveBookingQuestionnaire(pending).catch(() => notify.error("Could not save the booking template settings."));
    }, 300);
  }

  function moveField(field: BookingTemplateField, direction: -1 | 1) {
    const fields = [...preferences.enabledCoreFields];
    const index = fields.indexOf(field);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= fields.length) return;
    [fields[index], fields[target]] = [fields[target], fields[index]];
    savePreferences({ ...preferences, enabledCoreFields: fields });
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(template);
      notify.success("Client booking template copied.");
    } catch {
      notify.error("Could not copy automatically. Select and copy the template below.");
    }
  }

  if (mode === "choose") {
    return <div className="grid gap-3 sm:grid-cols-3">
      <MethodButton icon={FilePenLine} title="Create manually" detail="Enter the booking details yourself." onClick={() => onModeChange("manual")} />
      <MethodButton icon={ClipboardPaste} title="Paste booking text" detail="Parse a completed Qai client template, then review it." onClick={() => onModeChange("paste")} />
      <MethodButton icon={Clipboard} title="Copy client template" detail="Send a structured form through any chat app." onClick={() => onModeChange("template")} />
    </div>;
  }

  if (mode === "template") {
    return <div className="grid min-w-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-5 rounded-2xl border border-border bg-muted/25 p-4 sm:p-5">
        <div><div className="flex items-center gap-2"><Settings2 className="size-4 text-primary" /><h3 className="font-bold">Template settings</h3></div><p className="mt-1 text-sm text-muted-foreground">Keep it structured so Qai can parse the reply reliably.</p></div>
        <div><Label htmlFor="template-introduction" className="mb-2 block">Introduction</Label><Textarea id="template-introduction" rows={3} value={preferences.introduction} onChange={(event) => savePreferences({ ...preferences, introduction: event.target.value })} /></div>
        <fieldset><legend className="text-sm font-semibold">Fields and order</legend><div className="mt-2 space-y-2">{orderedFields.map((field) => { const index = preferences.enabledCoreFields.indexOf(field); const enabled = index >= 0; return <div key={field} className="flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm"><label className="flex min-w-0 flex-1 items-center gap-2"><input type="checkbox" checked={enabled} onChange={(event) => savePreferences({ ...preferences, enabledCoreFields: event.target.checked ? [...preferences.enabledCoreFields, field] : preferences.enabledCoreFields.filter((item) => item !== field) })} /><span className="truncate">{BOOKING_CORE_FIELD_LABELS[field]}</span></label>{enabled && <><Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${BOOKING_CORE_FIELD_LABELS[field]} earlier`} disabled={index === 0} onClick={() => moveField(field, -1)}><ArrowUp className="size-4" /></Button><Button type="button" size="icon-sm" variant="ghost" aria-label={`Move ${BOOKING_CORE_FIELD_LABELS[field]} later`} disabled={index === preferences.enabledCoreFields.length - 1} onClick={() => moveField(field, 1)}><ArrowDown className="size-4" /></Button></>}</div>; })}</div></fieldset>
        {preferences.questions.some((question) => question.active) && <p className="rounded-xl bg-card p-3 text-xs leading-5 text-muted-foreground">{preferences.questions.filter((question) => question.active).length} configured additional question{preferences.questions.filter((question) => question.active).length === 1 ? "" : "s"} will be included automatically. Manage them in Settings - Booking questions.</p>}
        <div><Label htmlFor="template-closing" className="mb-2 block">Closing message</Label><Textarea id="template-closing" rows={3} value={preferences.closing} onChange={(event) => savePreferences({ ...preferences, closing: event.target.value })} /></div>
      </section>
      <section className="min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-bold">Client copy</h3><p className="mt-1 text-sm text-muted-foreground">Works in WhatsApp, Instagram, SMS, and other chat apps.</p></div><Button type="button" onClick={() => void copyTemplate()}><Clipboard className="size-4" /> Copy template</Button></div><Textarea className="mt-4 min-h-96 resize-y font-mono text-sm leading-6" readOnly value={template} aria-label="Client booking template" /></section>
      <div className="lg:col-span-2"><Button type="button" variant="ghost" onClick={() => onModeChange("choose")}>Back to booking options</Button></div>
    </div>;
  }

  return <div className="space-y-5">
    <section className="rounded-2xl border border-border bg-muted/25 p-4 sm:p-5"><Label htmlFor="booking-text" className="mb-2 block font-semibold">Completed client text</Label><Textarea id="booking-text" className="min-h-64 resize-y bg-card font-mono text-sm leading-6" value={source} onChange={(event) => { setSource(event.target.value); setParsed(null); }} placeholder="Name:&#10;Phone:&#10;Instagram:&#10;Service:&#10;Date:&#10;Start time:&#10;Location:&#10;Notes:" /><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between"><Button type="button" variant="ghost" onClick={() => onModeChange("choose")}>Back</Button><Button type="button" onClick={parse}><ClipboardPaste className="size-4" /> Parse booking text</Button></div></section>
    {parsed && <section className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Parsed — review required</p><h3 className="mt-1 text-lg font-bold">Check the matched details before continuing</h3></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Not saved</span></div>
      {parsed.warnings.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><ul className="space-y-1">{parsed.warnings.map((warning) => <li key={warning}>• {warning}</li>)}</ul></div>}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><ReviewValue label="Client" value={parsed.name} /><ReviewValue label="Phone" value={parsed.phone} /><ReviewValue label="Instagram" value={parsed.instagram} /><ReviewValue label="Service" value={parsed.service} /><ReviewValue label="Date" value={parsed.date} /><ReviewValue label="Start time" value={parsed.startTime} /></dl>
      {parsed.customResponses.length > 0 && <div className="mt-4"><HistoricalQuestionnaireResponses responses={parsed.customResponses} /></div>}
      {customerMatch?.kind === "exact" && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Existing client found: {customerMatch.matches[0].name}</strong><label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={customerChoice === customerMatch.matches[0].id} onChange={(event) => setCustomerChoice(event.target.checked ? customerMatch.matches[0].id : "")} /> Use existing client</label></div>}
      {customerMatch?.kind === "ambiguous" && <div className="mt-4"><Label htmlFor="client-match" className="mb-2 block">Several clients match — choose one or create a new client</Label><select id="client-match" className="native-control" value={customerChoice} onChange={(event) => setCustomerChoice(event.target.value)}><option value="">Create/review as new client</option>{customerMatch.matches.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phone}</option>)}</select></div>}
      {serviceMatch?.kind === "ambiguous" && <div className="mt-4"><Label htmlFor="service-match" className="mb-2 block">Choose the matching service</Label><select id="service-match" className="native-control" value={serviceChoice} onChange={(event) => setServiceChoice(event.target.value)}><option value="">Choose in the booking form</option>{serviceMatch.matches.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></div>}
      {serviceMatch?.kind === "exact" && <p className="mt-4 rounded-xl bg-muted p-3 text-sm"><strong>Service matched:</strong> {serviceMatch.matches[0].name}</p>}
      <div className="mt-5 flex justify-end"><Button type="button" onClick={() => onReview({ parsed, customerId: customerChoice, serviceId: serviceChoice })}>Review in booking form <FilePenLine className="size-4" /></Button></div>
    </section>}
  </div>;
}

function MethodButton({ icon: Icon, title, detail, onClick }: { icon: typeof FilePenLine; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="group flex min-h-40 flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><span className="mt-6 font-bold">{title}</span><span className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</span></button>;
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted/55 p-3"><dt className="text-xs font-semibold text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value || "Needs review"}</dd></div>;
}
