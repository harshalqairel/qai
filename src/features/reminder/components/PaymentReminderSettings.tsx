"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/notifications";
import { saveReminderTemplates } from "../reminderTemplateRepository";
import {
  DEFAULT_REMINDER_TEMPLATES,
  LOCAL_BUSINESS_ID,
  MAX_REMINDER_SUBJECT_LENGTH,
  REMINDER_VARIABLES,
  SAMPLE_REMINDER_CONTEXT,
  renderReminderTemplate,
  scenarioTemplate,
  validateReminderTemplate,
  validateReminderTemplateSet,
} from "../reminderTemplates";
import type { ReminderScenarioTemplate, ReminderTemplateSet, ReminderType } from "../types";
import { useReminderTemplates } from "../useReminderTemplates";

type TemplateField = keyof ReminderScenarioTemplate;
const FIELD_LABELS: Record<TemplateField, string> = {
  whatsapp: "WhatsApp message",
  emailSubject: "Email subject",
  emailBody: "Email message",
};

function scenarioKey(type: ReminderType): keyof ReminderTemplateSet {
  return type === "overdue" ? "overdue" : "dueSoon";
}

export default function PaymentReminderSettings({ businessId = LOCAL_BUSINESS_ID }: { businessId?: string }) {
  const { templates: persisted, isLoaded } = useReminderTemplates(businessId);
  const [draft, setDraft] = useState<ReminderTemplateSet>(() => structuredClone(persisted));
  const [type, setType] = useState<ReminderType>("due-soon");
  const [activeField, setActiveField] = useState<TemplateField>("whatsapp");
  const inputs = useRef<Partial<Record<TemplateField, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const selected = scenarioTemplate(draft, type);
  const defaults = scenarioTemplate(DEFAULT_REMINDER_TEMPLATES, type);
  const key = scenarioKey(type);

  useEffect(() => {
    if (!isLoaded) return;
    const timeoutId = window.setTimeout(() => setDraft(structuredClone(persisted)), 0);
    return () => window.clearTimeout(timeoutId);
  }, [isLoaded, persisted]);

  function update(field: TemplateField, value: string) {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  }

  function insertVariable(token: string) {
    if (!token) return;
    const input = inputs.current[activeField];
    const value = selected[activeField];
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? start;
    update(activeField, `${value.slice(0, start)}${token}${value.slice(end)}`);
    window.setTimeout(() => {
      input?.focus();
      input?.setSelectionRange(start + token.length, start + token.length);
    }, 0);
  }

  function resetField(field: TemplateField) {
    if (selected[field] !== defaults[field] && !window.confirm(`Reset ${FIELD_LABELS[field]} to the Qai default?`)) return;
    update(field, defaults[field]);
  }

  function save() {
    const errors = validateReminderTemplateSet(draft);
    if (errors.length > 0) {
      notify.error(errors[0]);
      return;
    }
    try {
      saveReminderTemplates(businessId, draft);
      notify.success("Changes saved.");
    } catch {
      notify.error("Could not save reminder templates.");
    }
  }

  const whatsappPreview = renderReminderTemplate(selected.whatsapp, SAMPLE_REMINDER_CONTEXT);
  const subjectPreview = renderReminderTemplate(selected.emailSubject, SAMPLE_REMINDER_CONTEXT);
  const bodyPreview = renderReminderTemplate(selected.emailBody, SAMPLE_REMINDER_CONTEXT);

  return (
    <section className="surface-card overflow-hidden">
      <div className="border-b border-border p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight">Payment reminders</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose the messages Qai prepares when you follow up on a payment.</p>
        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1" role="tablist" aria-label="Reminder scenario">
          {(["due-soon", "overdue"] as const).map((option) => (
            <button key={option} type="button" role="tab" aria-selected={type === option} onClick={() => setType(option)} className={`min-h-11 rounded-lg px-3 text-sm font-semibold ${type === option ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {option === "due-soon" ? "Due soon" : "Overdue"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-w-0 gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0 space-y-6">
          <div>
            <Label htmlFor="reminder-variable" className="mb-2">Insert variable</Label>
            <select id="reminder-variable" className="native-control" defaultValue="" onChange={(event) => { insertVariable(event.target.value); event.target.value = ""; }}>
              <option value="" disabled>Choose a friendly variable</option>
              {REMINDER_VARIABLES.map((variable) => <option key={variable.token} value={variable.token}>{variable.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">The variable is inserted into the field you last selected.</p>
          </div>

          {(["whatsapp", "emailSubject", "emailBody"] as const).map((field) => {
            const limit = field === "emailSubject" ? MAX_REMINDER_SUBJECT_LENGTH : 4000;
            const errors = validateReminderTemplate(selected[field], limit);
            const id = `reminder-${type}-${field}`;
            return (
              <div key={field}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Label htmlFor={id}>{FIELD_LABELS[field]}</Label>
                  <Button type="button" size="sm" variant="ghost" onClick={() => resetField(field)}><RotateCcw className="size-3.5" aria-hidden="true" /> Reset to default</Button>
                </div>
                {field === "emailSubject" ? (
                  <Input id={id} ref={(node) => { inputs.current[field] = node; }} value={selected[field]} maxLength={limit} onFocus={() => setActiveField(field)} onChange={(event) => update(field, event.target.value)} aria-invalid={errors.length > 0} />
                ) : (
                  <Textarea id={id} ref={(node) => { inputs.current[field] = node; }} value={selected[field]} rows={field === "whatsapp" ? 8 : 9} maxLength={limit} onFocus={() => setActiveField(field)} onChange={(event) => update(field, event.target.value)} aria-invalid={errors.length > 0} className="min-h-44 resize-y" />
                )}
                <div className="mt-1 flex items-start justify-between gap-3 text-xs">
                  <span className="text-destructive" role={errors.length ? "alert" : undefined}>{errors[0] ?? ""}</span>
                  <span className="shrink-0 text-muted-foreground">{selected[field].length}/{limit}</span>
                </div>
              </div>
            );
          })}

          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={save}><Save className="size-4" aria-hidden="true" /> Save templates</Button>
        </div>

        <aside className="min-w-0 self-start rounded-xl border border-border bg-muted/35 p-4 xl:sticky xl:top-6" aria-label="Preview">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
          <p className="mt-1 text-xs text-muted-foreground">Sample data · Sarah · Qai Studio · Wedding Makeup</p>
          <div className="mt-4 space-y-4">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">WhatsApp</h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{whatsappPreview.value || whatsappPreview.errors[0]}</p>
            </section>
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Email</h3>
              <p className="mt-3 break-words text-sm font-semibold">{subjectPreview.value || subjectPreview.errors[0]}</p>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{bodyPreview.value || bodyPreview.errors[0]}</p>
            </section>
          </div>
        </aside>
      </div>
    </section>
  );
}
