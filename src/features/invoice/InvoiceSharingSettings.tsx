"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notify } from "@/lib/notifications";
import {
  DEFAULT_INVOICE_SHARE_TEMPLATES,
  INVOICE_SHARE_VARIABLES,
  getInvoiceShareTemplates,
  insertInvoiceTemplateVariable,
  renderInvoiceShareTemplate,
  saveInvoiceShareTemplates,
  validateInvoiceShareTemplate,
  type InvoiceShareContext,
  type InvoiceShareTemplates,
} from "./invoice";

type TemplateField = keyof InvoiceShareTemplates;
const LABELS: Record<TemplateField, string> = { whatsapp: "WhatsApp message", emailSubject: "Email subject", emailBody: "Email message" };
const SAMPLE: InvoiceShareContext = {
  clientName: "Sarah Wijaya", businessName: "Nuyi Makeup Studio", invoiceNumber: "INV-2026-0008", invoiceDate: "11 Aug 2026",
  dueDate: "18 Aug 2026", invoiceTotal: "Rp 7.500.000", amountPaid: "Rp 2.000.000", amountRemaining: "Rp 5.500.000",
  serviceName: "Wedding Package", bookingDate: "12 Aug 2026", nextSchedule: "15 Aug 2026", paymentInstructions: "BCA 1234567890",
};

export default function InvoiceSharingSettings() {
  const [draft, setDraft] = useState<InvoiceShareTemplates>(DEFAULT_INVOICE_SHARE_TEMPLATES);
  const [loaded, setLoaded] = useState(false);
  const [activeField, setActiveField] = useState<TemplateField>("whatsapp");
  const fields = useRef<Partial<Record<TemplateField, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  useEffect(() => { const timer = window.setTimeout(() => { setDraft(getInvoiceShareTemplates()); setLoaded(true); }, 0); return () => window.clearTimeout(timer); }, []);

  function update(field: TemplateField, value: string) { setDraft((current) => ({ ...current, [field]: value })); }
  function insertVariable(token: string) {
    if (!token) return;
    const field = fields.current[activeField]; const value = draft[activeField]; const start = field?.selectionStart ?? value.length; const end = field?.selectionEnd ?? start;
    update(activeField, insertInvoiceTemplateVariable(value, token, start, end));
    window.setTimeout(() => { field?.focus(); field?.setSelectionRange(start + token.length, start + token.length); }, 0);
  }
  function reset(field: TemplateField) {
    if (draft[field] !== DEFAULT_INVOICE_SHARE_TEMPLATES[field] && !window.confirm(`Reset ${LABELS[field]} to the Qai default?`)) return;
    update(field, DEFAULT_INVOICE_SHARE_TEMPLATES[field]);
  }
  function save() {
    const errors = Object.entries(draft).flatMap(([field, value]) => validateInvoiceShareTemplate(value, field === "emailSubject" ? 200 : 4000));
    if (errors.length) return notify.error(errors[0]);
    try { saveInvoiceShareTemplates(draft); notify.success("Invoice sharing templates saved."); } catch { notify.error("Could not save invoice sharing templates."); }
  }

  if (!loaded) return <section className="surface-card min-h-48 p-6" aria-busy="true" />;
  const previews = {
    whatsapp: renderInvoiceShareTemplate(draft.whatsapp, SAMPLE),
    emailSubject: renderInvoiceShareTemplate(draft.emailSubject, SAMPLE),
    emailBody: renderInvoiceShareTemplate(draft.emailBody, SAMPLE),
  };

  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border p-5 sm:p-6">
        <h2 className="text-lg font-bold tracking-tight">Invoice sharing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose the message Qai prepares when you share an invoice.</p>
      </header>
      <div className="grid min-w-0 gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        <div className="min-w-0 space-y-6">
          <div>
            <Label htmlFor="invoice-variable" className="mb-2">Insert variable</Label>
            <select id="invoice-variable" className="native-control" defaultValue="" onChange={(event) => { insertVariable(event.target.value); event.target.value = ""; }}>
              <option value="" disabled>Choose a friendly variable</option>
              {INVOICE_SHARE_VARIABLES.map((variable) => <option value={variable.token} key={variable.token}>{variable.label}</option>)}
            </select>
            <p className="mt-2 text-xs text-muted-foreground">The variable is inserted where your cursor was last placed.</p>
          </div>
          {(["whatsapp", "emailSubject", "emailBody"] as const).map((field) => {
            const limit = field === "emailSubject" ? 200 : 4000; const errors = validateInvoiceShareTemplate(draft[field], limit);
            return <div key={field}>
              <div className="mb-2 flex items-center justify-between gap-3"><Label htmlFor={`invoice-share-${field}`}>{LABELS[field]}</Label><Button type="button" size="sm" variant="ghost" onClick={() => reset(field)}><RotateCcw className="size-3.5" /> Reset to default</Button></div>
              {field === "emailSubject" ? <Input id={`invoice-share-${field}`} ref={(node) => { fields.current[field] = node; }} value={draft[field]} onFocus={() => setActiveField(field)} onChange={(event) => update(field, event.target.value)} maxLength={limit} aria-invalid={errors.length > 0} /> : <Textarea id={`invoice-share-${field}`} ref={(node) => { fields.current[field] = node; }} value={draft[field]} onFocus={() => setActiveField(field)} onChange={(event) => update(field, event.target.value)} rows={8} maxLength={limit} className="min-h-44 resize-y" aria-invalid={errors.length > 0} />}
              <div className="mt-1 flex justify-between gap-3 text-xs"><span className="text-destructive" role={errors.length ? "alert" : undefined}>{errors[0] ?? ""}</span><span className="shrink-0 text-muted-foreground">{draft[field].length}/{limit}</span></div>
            </div>;
          })}
          <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={save}><Save className="size-4" /> Save templates</Button>
        </div>
        <aside className="min-w-0 self-start rounded-xl border border-border bg-muted/35 p-4 xl:sticky xl:top-6" aria-label="Live template preview">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Live preview</p>
          <p className="mt-1 text-xs text-muted-foreground">Sarah Wijaya · Nuyi Makeup Studio · INV-2026-0008</p>
          <section className="mt-4 rounded-xl border border-border bg-card p-4"><h3 className="text-sm font-semibold">WhatsApp</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{previews.whatsapp.value || previews.whatsapp.errors[0]}</p></section>
          <section className="mt-4 rounded-xl border border-border bg-card p-4"><h3 className="text-sm font-semibold">Email</h3><p className="mt-3 break-words text-sm font-semibold">{previews.emailSubject.value || previews.emailSubject.errors[0]}</p><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{previews.emailBody.value || previews.emailBody.errors[0]}</p></section>
        </aside>
      </div>
    </section>
  );
}
