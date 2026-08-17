/* eslint-disable @next/next/no-img-element -- Validation-only owner-provided data URLs cannot use the Next image optimizer. */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FilePenLine, History, Mail, MessageCircle, Plus, ReceiptText, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import EmptyState from "@/components/system/EmptyState";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { useServices } from "@/features/service/hooks/useServices";
import { subscribeToDataRefresh } from "@/lib/dataRefresh";
import { notify } from "@/lib/notifications";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { validationClient } from "@/features/qai-page/validation";
import {
  DEFAULT_INVOICE_SETTINGS,
  createBookingInvoiceDraft,
  createInvoiceRevision,
  formatInvoiceDate,
  generateInvoicePdf,
  getInvoiceSettings,
  getInvoiceShareTemplates,
  invoiceEmailUrl,
  invoicePaidAmount,
  invoicePaymentStatus,
  invoiceRemainingAmount,
  invoiceRepository,
  invoiceSchema,
  invoiceShareContext,
  invoiceTotals,
  invoiceTaxLabel,
  invoiceWatermarkLayout,
  invoiceWhatsAppUrl,
  issueInvoice,
  latestInvoiceVersions,
  renderInvoiceShareTemplate,
  saveInvoiceSettings,
  type Invoice,
  type InvoiceLineItem,
  type InvoiceSettings,
} from "./invoice";

type Filter = "All" | "Draft" | "Unpaid" | "Part paid" | "Paid";
type ShareChannel = "whatsapp" | "email";

function todayKey() { return new Date().toISOString().slice(0, 10); }
function newLineItem(): InvoiceLineItem { return { id: crypto.randomUUID(), item: "", description: "", quantity: 1, unitPrice: 0 }; }
function customDraft(settings: InvoiceSettings, client?: { id: string; name: string; phone: string; email: string }): Invoice {
  const now = Date.now(); const date = todayKey();
  const id = crypto.randomUUID();
  return {
    id, rootInvoiceId: id, previousVersionId: null, version: 1, businessId: settings.businessId, bookingId: null, clientId: client?.id ?? null, lifecycle: "Draft", invoiceNumber: null,
    clientName: client?.name ?? "", clientPhone: client?.phone ?? "", clientEmail: client?.email ?? "", serviceName: "", invoiceDate: date, dueDate: date,
    lineItems: [newLineItem()], discount: 0, tax: 0, discountMode: "none", discountValue: 0, taxPercent: 0, taxEnabled: false, taxName: "Tax", taxMode: "percentage", taxValue: 0, taxTreatment: "added", invoiceStyle: settings.invoiceStyle, paymentInstructions: settings.paymentInstructions, notes: settings.defaultNotes || settings.defaultPaymentTerms,
    schedules: [], showSchedules: settings.showSchedules, watermarkEnabled: settings.watermarkEnabled, watermarkImage: settings.watermarkImage, watermarkOpacity: settings.watermarkOpacity, watermarkRotation: settings.watermarkRotation, watermarkScale: settings.watermarkScale, snapshot: null, createdAt: now, updatedAt: now, issuedAt: null,
  };
}

function paymentLabel(invoice: Invoice, payments: ReturnType<typeof usePayments>["payments"]) {
  return invoicePaymentStatus(invoiceTotals(invoice.snapshot ?? invoice).total, invoicePaidAmount(invoice, payments));
}

function InvoiceStatus({ invoice, payments }: { invoice: Invoice; payments: ReturnType<typeof usePayments>["payments"] }) {
  const payment = paymentLabel(invoice, payments);
  return <span className="inline-flex flex-wrap items-center gap-1.5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${invoice.lifecycle === "Issued" ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>{invoice.lifecycle}</span><span className="text-xs text-muted-foreground">·</span><span className="text-xs font-semibold">{payment}</span></span>;
}

function InvoicePreview({ invoice, settings, payments }: { invoice: Invoice; settings: InvoiceSettings; payments: ReturnType<typeof usePayments>["payments"] }) {
  const source = invoice.snapshot ?? { ...invoice, ...invoiceTotals(invoice), invoiceNumber: invoice.invoiceNumber ?? "Draft", businessName: settings.businessName, legalName: settings.legalName, businessLogo: settings.businessLogo, address: settings.address, phone: settings.phone, email: settings.email, signatureImage: settings.signatureImage, stampImage: settings.stampImage, legalDisclaimer: settings.legalDisclaimer, version: invoice.version };
  const watermark = invoiceWatermarkLayout(source);
  const totals = invoiceTotals(source);
  const paid = invoicePaidAmount(invoice, payments);
  const remaining = Math.max(totals.total - paid, 0);
  const rootId = invoice.rootInvoiceId || invoice.id;
  const history = typeof window === "undefined" ? [] : invoiceRepository.getAll().filter((item) => (item.rootInvoiceId || item.id) === rootId).sort((left, right) => right.version - left.version || right.updatedAt - left.updatedAt);
  const modernClassic = source.invoiceStyle === "Modern Classic";
  const creative = source.invoiceStyle === "Creative";
  const professional = source.invoiceStyle === "Professional";
  const documentEdge = modernClassic ? "border-t-4 border-t-slate-950" : creative ? "border-t-[6px] border-t-primary" : professional ? "border-l-[8px] border-l-primary" : "border-t border-t-slate-300";
  const headerSurface = creative ? "bg-[#fbf7fa]" : "bg-white";
  const strongRule = modernClassic ? "border-slate-950" : "border-slate-300";
  const tableHeader = modernClassic || professional ? "border-slate-950 bg-slate-950 text-white" : creative ? "border-slate-200 bg-[#f7eff4] text-slate-800" : "border-slate-200 bg-slate-50 text-slate-700";
  const summaryPanel = modernClassic ? "rounded-none border-slate-950" : creative ? "rounded-lg border-primary/40" : "rounded-lg border-slate-200";
  const summaryTotal = modernClassic || professional ? "bg-slate-950 text-white" : creative ? "border-l-4 border-primary bg-[#f7eff4] text-slate-950" : "bg-slate-50 text-slate-950";
  const columns = modernClassic ? "sm:grid-cols-[48px_minmax(0,1fr)_64px_120px_128px]" : "sm:grid-cols-[minmax(0,1fr)_64px_120px_128px]";
  return <article data-invoice-layout={source.invoiceStyle} className={`relative mx-auto w-full max-w-[780px] overflow-hidden rounded-sm border border-slate-300 bg-white text-slate-950 shadow-sm ${documentEdge}`}>
    {watermark.enabled && <img src={watermark.image} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-20 max-h-[72%] object-contain" style={{ width: `${watermark.scale * 100}%`, opacity: watermark.opacity, transform: `translate(-50%, -50%) rotate(${watermark.rotation}deg)` }} />}
    {history.length > 1 && <nav aria-label="Invoice revision history" className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3"><span className="mr-1 text-xs font-bold uppercase tracking-wider text-slate-500">History</span>{history.map((version) => <a key={version.id} href={`/invoices?invoice=${encodeURIComponent(version.id)}`} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${version.id === invoice.id ? "border-primary bg-primary text-primary-foreground" : "border-slate-300 bg-white text-slate-700"}`}>V{version.version} · {version.lifecycle === "Issued" ? version.invoiceNumber : version.lifecycle}</a>)}</nav>}
    <div className="bg-white">
      <header className={`grid gap-6 px-5 pb-7 pt-7 sm:grid-cols-[1fr_auto] sm:px-9 sm:pb-8 sm:pt-9 lg:px-11 ${headerSurface} ${modernClassic ? "border-b-2 border-slate-950" : "border-b border-slate-300"}`}>
        <div className="flex min-w-0 items-start gap-5">{source.businessLogo && <img src={source.businessLogo} alt="" className="size-20 shrink-0 object-contain sm:size-24" />}<div className="min-w-0"><h2 className="break-words text-2xl font-black tracking-tight">{source.businessName}</h2>{source.legalName && <p className="mt-1 text-sm font-medium text-slate-700">{source.legalName}</p>}<p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{[source.address, source.phone, source.email].filter(Boolean).join("\n")}</p></div></div>
        <div className="sm:text-right"><p className={`text-3xl font-black tracking-[0.07em] ${modernClassic ? "text-slate-950" : "text-primary"}`}>INVOICE</p><p className="mt-2 text-sm font-bold text-slate-700">{source.invoiceNumber}</p></div>
      </header>
      <div className="p-5 sm:p-9 lg:p-11">
        <section className={`grid gap-6 border-b pb-7 sm:grid-cols-[1fr_auto] ${strongRule}`}><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Bill to</p><p className="mt-2 break-words text-lg font-black">{source.clientName}</p><p className="mt-1 break-words text-sm text-slate-600">{[source.clientPhone, source.clientEmail].filter(Boolean).join(" / ")}</p></div><dl className="grid grid-cols-2 gap-6 sm:justify-self-end"><div><dt className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Invoice date</dt><dd className="mt-2 text-sm font-semibold">{formatInvoiceDate(source.invoiceDate)}</dd></div><div><dt className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">Due date</dt><dd className="mt-2 text-sm font-semibold">{formatInvoiceDate(source.dueDate)}</dd></div></dl></section>
        <div className={`mt-7 overflow-hidden border-y ${modernClassic ? "border-y-2 border-slate-950" : "border-slate-300"}`}>
          <div className={`hidden gap-3 border-b px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] sm:grid ${columns} ${tableHeader}`}>{modernClassic && <span>No</span>}<span>Item</span><span className="text-right">Qty</span><span className="text-right">Unit price</span><span className="text-right">Amount</span></div>
          {source.lineItems.map((item, index) => <div key={item.id} className={`grid gap-2 border-b border-slate-200 px-4 py-4 last:border-b-0 sm:gap-3 ${columns}`}>{modernClassic && <p className="hidden text-sm text-slate-500 sm:block">{String(index + 1).padStart(2, "0")}</p>}<div><p className="break-words font-bold">{item.item}</p>{item.description && <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.description}</p>}</div><p className="text-sm sm:text-right"><span className="font-semibold sm:hidden">Quantity: </span>{item.quantity}</p><p className="text-sm tabular-nums sm:text-right"><span className="font-semibold sm:hidden">Unit price: </span>{formatRupiah(item.unitPrice)}</p><p className="font-bold tabular-nums sm:text-right">{formatRupiah(item.quantity * item.unitPrice)}</p></div>)}
        </div>
        <dl aria-label="Invoice financial summary" className={`ml-auto mt-7 w-full max-w-[320px] overflow-hidden border bg-white text-sm ${summaryPanel}`}>
          <div className="space-y-2 px-5 py-4"><div className="flex justify-between gap-8"><dt className="text-slate-500">Subtotal</dt><dd className="font-medium tabular-nums">{formatRupiah(totals.subtotal)}</dd></div>{totals.discount > 0 && <div className="flex justify-between gap-8"><dt className="text-slate-500">Discount{source.discountMode === "percentage" ? ` (${source.discountValue}%)` : ""}</dt><dd className="font-medium tabular-nums">-{formatRupiah(totals.discount)}</dd></div>}{totals.tax > 0 && <div className="flex justify-between gap-8"><dt className="text-slate-500">{invoiceTaxLabel(source)}</dt><dd className="font-medium tabular-nums">{source.taxTreatment === "deducted" ? "-" : ""}{formatRupiah(totals.tax)}</dd></div>}</div>
          <div className={`flex items-baseline justify-between gap-8 px-5 py-4 ${summaryTotal}`}><dt className="font-black">Grand total</dt><dd className="text-xl font-black tabular-nums">{formatRupiah(totals.total)}</dd></div>
          <div className="px-5 py-4"><p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Payment summary</p><div className={`mt-2 flex justify-between gap-8 ${modernClassic && paid > 0 ? "font-bold text-[#ae3041]" : "text-slate-700"}`}><dt>{modernClassic ? "Down payment" : "Paid"}</dt><dd className="tabular-nums">{formatRupiah(paid)}</dd></div><div className="mt-2 flex items-baseline justify-between gap-8"><dt className="font-black">Balance due</dt><dd className="text-lg font-black tabular-nums">{formatRupiah(remaining)}</dd></div>{paid > totals.total && <div className="mt-2 flex justify-between gap-8 font-semibold text-amber-700"><dt>Overpaid</dt><dd className="tabular-nums">{formatRupiah(paid - totals.total)}</dd></div>}</div>
        </dl>
        {source.showSchedules && source.schedules.length > 0 && <section className="mt-9 border-t border-slate-300 pt-6"><h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Schedule</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">{source.schedules.map((schedule, index) => { const start = new Date(schedule.startAt); const end = new Date(schedule.endAt); return <div key={`${schedule.startAt}-${index}`} className={`border-l-2 pl-3 text-sm ${modernClassic ? "border-slate-950" : "border-primary"}`}><p className="font-bold">{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(start)} / {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}-{end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jakarta" })}</p><p className="mt-1 text-slate-600">{[schedule.label, schedule.location].filter(Boolean).join(" / ")}</p></div>; })}</div></section>}
        {(source.paymentInstructions || source.notes) && <div className="mt-9 grid gap-7 border-t border-slate-300 pt-6 sm:grid-cols-2">{source.paymentInstructions && <section><h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Payment instructions</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{source.paymentInstructions}</p></section>}{source.notes && <section><h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Notes</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{source.notes}</p></section>}</div>}
        {(source.signatureImage || source.stampImage) && <section className="mt-9 border-t border-slate-300 pt-6"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Authorized signature</p><div className="relative mt-2 h-32 w-56">{source.signatureImage && <img src={source.signatureImage} alt="Visual business signature" className="absolute bottom-3 left-0 h-16 max-w-44 object-contain object-left" />}{source.stampImage && <img src={source.stampImage} alt="Business stamp" className="absolute bottom-0 left-12 z-10 h-24 w-24 object-contain" />}</div></section>}
      </div>
    </div>
    {settings.showQaiAttribution && <footer className="border-t border-slate-200 px-5 py-4 text-center text-xs text-slate-500">Created with Qai</footer>}
  </article>;
}

export default function InvoicePage() {
  const bookingData = useBookings(); const customerData = useCustomers(); const serviceData = useServices(); const paymentData = usePayments();
  const [invoices, setInvoices] = useState<Invoice[]>([]); const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_INVOICE_SETTINGS);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false); const handledDeepLink = useRef(false);
  const [filter, setFilter] = useState<Filter>("All"); const [newOpen, setNewOpen] = useState(false); const [bookingChoiceOpen, setBookingChoiceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false); const [settingsDraft, setSettingsDraft] = useState(settings); const [editing, setEditing] = useState<Invoice | null>(null);
  const [preview, setPreview] = useState<Invoice | null>(null); const [share, setShare] = useState<{ invoice: Invoice; channel: ShareChannel } | null>(null);
  const [shareMessage, setShareMessage] = useState(""); const [shareSubject, setShareSubject] = useState("");
  const reload = useCallback(() => { setInvoices(invoiceRepository.getAll().sort((a, b) => b.updatedAt - a.updatedAt)); setSettings(getInvoiceSettings()); setInvoicesLoaded(true); }, []);
  useEffect(() => { const timer = window.setTimeout(reload, 0); const unsubscribe = subscribeToDataRefresh(reload); return () => { window.clearTimeout(timer); unsubscribe(); }; }, [reload]);
  const rows = useMemo(() => latestInvoiceVersions(invoices).filter((invoice) => filter === "All" || (filter === "Draft" ? invoice.lifecycle !== "Issued" : paymentLabel(invoice, paymentData.payments) === filter)), [invoices, filter, paymentData.payments]);
  const createFromBooking = useCallback((bookingId: string, openMode: "edit" | "review" = "edit") => {
    const booking = bookingData.bookings.find((item) => item.id === bookingId); const customer = booking && customerData.customers.find((item) => item.id === booking.customerId); const service = booking && serviceData.services.find((item) => item.id === booking.serviceId);
    if (!booking || !customer || !service) return notify.error("Could not find the booking details.");
    const existing = latestInvoiceVersions(invoices.filter((item) => item.bookingId === bookingId))[0];
    if (existing) { setPreview(existing); setBookingChoiceOpen(false); setNewOpen(false); notify.info("This booking already has an invoice."); return; }
    const draft = createBookingInvoiceDraft({ booking, customer, service, settings }); invoiceRepository.save(draft);
    if (openMode === "review") setPreview(draft); else setEditing(draft);
    setBookingChoiceOpen(false); setNewOpen(false);
  }, [bookingData.bookings, customerData.customers, invoices, serviceData.services, settings]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (handledDeepLink.current || !invoicesLoaded || bookingData.isLoading || customerData.isLoading || serviceData.isLoading) return;
      const params = new URLSearchParams(window.location.search);
      const bookingId = params.get("booking");
      const invoiceId = params.get("invoice");
      const action = params.get("action");

      if (params.get("new") === "1") {
        handledDeepLink.current = true;
        setNewOpen(true);
        return;
      }

      if (invoiceId) {
        const selected = invoices.find((invoice) => invoice.id === invoiceId);
        if (!selected) return;
        handledDeepLink.current = true;
        if (action === "edit" && selected.lifecycle !== "Issued") setEditing(selected);
        else {
          setPreview(selected);
          if (action === "download" && selected.lifecycle === "Issued") void generateInvoicePdf(selected, settings, paymentData.payments);
        }
        return;
      }

      if (bookingId && bookingData.bookings.some((item) => item.id === bookingId)) {
        handledDeepLink.current = true;
        const existing = latestInvoiceVersions(invoices.filter((item) => item.bookingId === bookingId))[0];
        if (existing) setPreview(existing);
        else createFromBooking(bookingId, action === "issue" ? "review" : "edit");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bookingData.isLoading, bookingData.bookings, createFromBooking, customerData.isLoading, invoices, invoicesLoaded, paymentData.payments, serviceData.isLoading, settings]);
  function saveDraft(value: Invoice) { try { const saved = invoiceRepository.save(invoiceSchema.parse({ ...value, updatedAt: Date.now() })); setEditing(null); setPreview(saved); notify.success("Invoice draft saved."); } catch { notify.error("Check the client, dates, and line items."); } }
  async function issue(value: Invoice) { try { let allocated: string | undefined; let sequence: number | undefined; if (isValidationModeEnabled() && value.version === 1) { const response = await fetch("/api/validation/invoices/allocate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: settings.invoicePrefix, year: new Date().getFullYear(), minimumSequence: settings.nextInvoiceSequence, padding: settings.invoiceNumberPadding }) }); const result = await response.json() as { data?: { invoiceNumber: string; sequence: number } }; if (!response.ok || !result.data) throw new Error("allocation"); allocated = result.data.invoiceNumber; sequence = result.data.sequence; } const issued = invoiceRepository.save(issueInvoice(value, settings, invoices, Date.now(), allocated)); if (value.version === 1) { const nextSettings = { ...settings, nextInvoiceSequence: Math.max(settings.nextInvoiceSequence, (sequence ?? settings.nextInvoiceSequence) + 1) }; saveInvoiceSettings(nextSettings); setSettings(nextSettings); } setPreview(issued); notify.success(`Invoice ${issued.invoiceNumber} issued.`); } catch { notify.error("Could not issue this invoice. Check its details."); } }
  function revise(value: Invoice) { try { const rootId = value.rootInvoiceId || value.id; const history = invoices.filter((item) => (item.rootInvoiceId || item.id) === rootId); const existingDraft = history.find((item) => item.lifecycle === "Revision Draft"); if (existingDraft) { setPreview(null); setEditing(existingDraft); notify.info("Opened the existing revision draft."); return; } const nextVersion = Math.max(...history.map((item) => item.version), value.version) + 1; const revision = invoiceRepository.save(createInvoiceRevision(value, Date.now(), nextVersion)); setPreview(null); setEditing(revision); notify.info("Revision draft created. The issued version remains unchanged."); } catch { notify.error("Could not create a revision draft."); } }
  function remove(value: Invoice) { if (!window.confirm("Delete this invoice? This can't be undone.")) return; invoiceRepository.delete(value.id); if (preview?.id === value.id) setPreview(null); notify.success("Invoice deleted."); }
  function beginShare(value: Invoice, channel: ShareChannel) {
    const templates = getInvoiceShareTemplates(); const context = invoiceShareContext(value, settings, paymentData.payments);
    const message = renderInvoiceShareTemplate(channel === "whatsapp" ? templates.whatsapp : templates.emailBody, context); const subject = renderInvoiceShareTemplate(templates.emailSubject, context);
    if (message.errors.length || subject.errors.length) return notify.error(message.errors[0] ?? subject.errors[0]);
    setShareMessage(message.value); setShareSubject(subject.value); setShare({ invoice: value, channel });
  }
  function openTransport() {
    if (!share) return; const value = share.invoice;
    if (share.channel === "whatsapp") { if (!value.clientPhone) return; window.open(invoiceWhatsAppUrl(value.clientPhone, shareMessage), "_blank", "noopener,noreferrer"); }
    else { if (!value.clientEmail) return; window.location.href = invoiceEmailUrl(value.clientEmail, shareSubject, shareMessage); }
  }
  function saveSettings() { try { saveInvoiceSettings(settingsDraft); setSettings(settingsDraft); setSettingsOpen(false); notify.success("Invoice settings saved."); } catch { notify.error("Check the business name, numbering, and invoice assets."); } }
  async function uploadInvoiceAsset(file: File | undefined, kind: "invoice-logo" | "invoice-signature" | "invoice-stamp" | "invoice-watermark", field: "businessLogo" | "signatureImage" | "stampImage" | "watermarkImage") { if (!file) return; if (!isValidationModeEnabled()) { const reader = new FileReader(); reader.onload = () => setSettingsDraft((current) => ({ ...current, [field]: String(reader.result ?? "") })); reader.readAsDataURL(file); return; } try { const uploaded = await validationClient.uploadMedia(file, kind); setSettingsDraft((current) => ({ ...current, [field]: uploaded.url })); } catch (error) { notify.error(error instanceof Error ? error.message : "Could not upload that image."); } }

  return <main className="min-h-screen"><div className="page-shell">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="page-title">Invoices</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Create, issue, download, and share professional invoices.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setSettingsDraft(settings); setSettingsOpen(true); }}><Settings2 className="size-4" /> Invoice settings</Button><Button onClick={() => setNewOpen(true)}><Plus className="size-4" /> New invoice</Button></div></header>
    <div className="filter-bar"><div className="flex flex-wrap gap-2" role="group" aria-label="Invoice filters">{(["All", "Draft", "Unpaid", "Part paid", "Paid"] as Filter[]).map((value) => <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value}</Button>)}</div></div>
    {rows.length === 0 ? <EmptyState icon={ReceiptText} title={invoices.length ? "No matching invoices" : "No invoices yet"} description={invoices.length ? "Choose another filter." : "Create an invoice from a booking or make a custom invoice."} actionLabel={!invoices.length ? "New invoice" : undefined} onAction={!invoices.length ? () => setNewOpen(true) : undefined} /> : <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block"><table className="w-full table-fixed text-left text-sm"><thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="w-[17%] px-4 py-3">Invoice</th><th className="w-[18%] px-4 py-3">Client</th><th className="w-[12%] px-4 py-3">Date</th><th className="w-[12%] px-4 py-3">Due</th><th className="w-[14%] px-4 py-3 text-right">Total</th><th className="w-[14%] px-4 py-3 text-right">Remaining</th><th className="w-[13%] px-4 py-3">Status</th></tr></thead><tbody>{rows.map((invoice) => <tr key={invoice.id} tabIndex={0} onClick={() => setPreview(invoice)} onKeyDown={(event) => { if (event.key === "Enter") setPreview(invoice); }} className="cursor-pointer border-t border-border hover:bg-muted/35"><td className="px-4 py-4 font-semibold">{invoice.invoiceNumber ?? "Draft"}</td><td className="truncate px-4 py-4">{invoice.clientName}</td><td className="px-4 py-4">{formatInvoiceDate(invoice.invoiceDate)}</td><td className="px-4 py-4">{formatInvoiceDate(invoice.dueDate)}</td><td className="px-4 py-4 text-right font-semibold tabular-nums">{formatRupiah(invoiceTotals(invoice.snapshot ?? invoice).total)}</td><td className="px-4 py-4 text-right font-semibold tabular-nums">{formatRupiah(invoiceRemainingAmount(invoice, paymentData.payments))}</td><td className="px-4 py-4"><InvoiceStatus invoice={invoice} payments={paymentData.payments} /></td></tr>)}</tbody></table></div>
      <div className="space-y-3 md:hidden">{rows.map((invoice) => <article key={invoice.id} className="surface-card p-4" onClick={() => setPreview(invoice)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{invoice.invoiceNumber ?? "Draft"}</p><p className="mt-1 truncate text-sm text-muted-foreground">{invoice.clientName}</p></div><p className="shrink-0 font-bold">{formatRupiah(invoiceTotals(invoice.snapshot ?? invoice).total)}</p></div><div className="mt-3 flex items-end justify-between gap-3"><div><p className="text-xs text-muted-foreground">{formatInvoiceDate(invoice.invoiceDate)} · due {formatInvoiceDate(invoice.dueDate)}</p><div className="mt-2"><InvoiceStatus invoice={invoice} payments={paymentData.payments} /></div></div><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setPreview(invoice); }}>View</Button></div></article>)}</div>
    </>}
  </div>

  <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent><DialogHeader><DialogTitle>New invoice</DialogTitle><DialogDescription>Choose how you want to start.</DialogDescription></DialogHeader><div className="grid gap-3"><button type="button" onClick={() => setBookingChoiceOpen(true)} className="rounded-xl border border-border p-4 text-left hover:bg-muted"><p className="font-semibold">From a booking</p><p className="mt-1 text-sm text-muted-foreground">Use an existing booking and its payment details.</p></button><button type="button" onClick={() => { setEditing(customDraft(settings, customerData.customers[0])); setNewOpen(false); }} className="rounded-xl border border-border p-4 text-left hover:bg-muted"><p className="font-semibold">Custom invoice</p><p className="mt-1 text-sm text-muted-foreground">Create an invoice manually.</p></button></div></DialogContent></Dialog>
  <Dialog open={bookingChoiceOpen} onOpenChange={setBookingChoiceOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Choose a booking</DialogTitle><DialogDescription>The invoice will use its client, service, schedules, price, and recorded payments.</DialogDescription></DialogHeader><div className="max-h-[55vh] space-y-2 overflow-y-auto">{bookingData.bookings.length ? bookingData.bookings.map((booking) => { const customer = customerData.customers.find((item) => item.id === booking.customerId); const service = serviceData.services.find((item) => item.id === booking.serviceId); return <button type="button" key={booking.id} onClick={() => createFromBooking(booking.id)} className="w-full rounded-xl border border-border p-4 text-left hover:bg-muted"><p className="font-semibold">{customer?.name ?? "Client not found"}</p><p className="mt-1 text-sm text-muted-foreground">{service?.name ?? "Service not found"} · {booking.sessions.length} {booking.sessions.length === 1 ? "schedule" : "schedules"} · {formatRupiah(booking.servicePrice)}</p></button>; }) : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Add a booking before creating a booking-linked invoice.</p>}</div></DialogContent></Dialog>
  <InvoiceEditor key={editing?.id ?? "closed"} invoice={editing} customers={customerData.customers} onClose={() => setEditing(null)} onSave={saveDraft} />
  <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}><DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] p-3 sm:max-w-5xl sm:p-6"><DialogHeader className="px-1"><DialogTitle>Invoice preview</DialogTitle><DialogDescription>{preview?.lifecycle !== "Issued" ? `${preview?.lifecycle} · review before issuing` : `${preview?.invoiceNumber} · Version ${preview?.version} · ${preview && paymentLabel(preview, paymentData.payments)}`}</DialogDescription></DialogHeader>{preview && <><div className="min-w-0 overflow-y-auto rounded-xl bg-muted/40 p-2 sm:p-4"><InvoicePreview invoice={preview} settings={settings} payments={paymentData.payments} /></div><DialogFooter className="flex-wrap sm:justify-between"><div className="flex flex-wrap gap-2">{preview.lifecycle !== "Issued" ? <><Button variant="outline" onClick={() => { setEditing(preview); setPreview(null); }}><FilePenLine className="size-4" /> Edit</Button><Button variant="destructive" onClick={() => remove(preview)}><Trash2 className="size-4" /> Delete</Button></> : <><Button variant="outline" onClick={() => void generateInvoicePdf(preview, settings, paymentData.payments)}><Download className="size-4" /> Download PDF</Button><Button variant="outline" onClick={() => revise(preview)}><History className="size-4" /> Edit &amp; reissue</Button><Button variant="outline" onClick={() => beginShare(preview, "whatsapp")} disabled={!preview.clientPhone}><MessageCircle className="size-4" /> WhatsApp</Button><Button variant="outline" onClick={() => beginShare(preview, "email")} disabled={!preview.clientEmail}><Mail className="size-4" /> Email</Button></>}</div>{preview.lifecycle !== "Issued" && <Button onClick={() => void issue(preview)}>Issue {preview.lifecycle === "Revision Draft" ? `version ${preview.version}` : "invoice"}</Button>}</DialogFooter>{preview.lifecycle === "Issued" && (!preview.clientPhone || !preview.clientEmail) && <div className="px-1 text-xs text-muted-foreground">{!preview.clientPhone && <p>No phone number saved for this client.</p>}{!preview.clientEmail && <p>No email saved for this client.</p>}</div>}</>}</DialogContent></Dialog>
  <Dialog open={Boolean(share)} onOpenChange={(open) => { if (!open) setShare(null); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Share invoice</DialogTitle><DialogDescription>{share?.channel === "whatsapp" ? "Review this one-time WhatsApp message before opening WhatsApp." : "Review this one-time email before opening your email app."}</DialogDescription></DialogHeader>{share?.channel === "email" && <div><Label htmlFor="share-subject">Subject</Label><Input id="share-subject" className="mt-2" value={shareSubject} onChange={(event) => setShareSubject(event.target.value)} /></div>}<div><Label htmlFor="share-message">{share?.channel === "whatsapp" ? "WhatsApp message" : "Message"}</Label><Textarea id="share-message" className="mt-2 min-h-56 resize-y" value={shareMessage} onChange={(event) => setShareMessage(event.target.value)} /></div>{share?.channel === "whatsapp" && <p className="text-xs text-muted-foreground">Download the invoice first if you want to attach the PDF. Opening WhatsApp does not confirm delivery.</p>}{share?.channel === "email" && <p className="text-xs text-muted-foreground">Your email app cannot attach the PDF automatically.</p>}<DialogFooter><Button variant="outline" onClick={() => setShare(null)}>Cancel</Button><Button onClick={openTransport}>{share?.channel === "whatsapp" ? "Open WhatsApp" : "Open email"}</Button></DialogFooter></DialogContent></Dialog>
  <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
    <DialogContent className="max-h-[calc(100dvh-1rem)] sm:max-w-2xl">
      <DialogHeader><DialogTitle>Invoice settings</DialogTitle><DialogDescription>Set the business identity and default style used across invoice previews and PDFs.</DialogDescription></DialogHeader>
      <div className="grid gap-5 sm:grid-cols-2">
        <AssetField label="Business logo" value={settingsDraft.businessLogo} onUpload={(file) => void uploadInvoiceAsset(file, "invoice-logo", "businessLogo")} onRemove={() => setSettingsDraft({ ...settingsDraft, businessLogo: "" })} />
        <AssetField label="Visual signature (optional)" value={settingsDraft.signatureImage} onUpload={(file) => void uploadInvoiceAsset(file, "invoice-signature", "signatureImage")} onRemove={() => setSettingsDraft({ ...settingsDraft, signatureImage: "" })} />
        <AssetField label="Business stamp (optional)" value={settingsDraft.stampImage} onUpload={(file) => void uploadInvoiceAsset(file, "invoice-stamp", "stampImage")} onRemove={() => setSettingsDraft({ ...settingsDraft, stampImage: "" })} />
        <div className="sm:col-span-2 rounded-xl border border-border p-4">
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={settingsDraft.watermarkEnabled} onChange={(event) => setSettingsDraft({ ...settingsDraft, watermarkEnabled: event.target.checked })} className="size-4" /><span className="text-sm font-semibold">Use invoice watermark by default</span></label>
          <div className="mt-3 grid gap-4 sm:grid-cols-2"><AssetField label="Watermark image" value={settingsDraft.watermarkImage} onUpload={(file) => void uploadInvoiceAsset(file, "invoice-watermark", "watermarkImage")} onRemove={() => setSettingsDraft({ ...settingsDraft, watermarkImage: "", watermarkEnabled: false })} /><Field label={`Opacity (${Math.round(settingsDraft.watermarkOpacity * 100)}%)`}><Input type="range" min="6" max="20" step="1" value={Math.round(settingsDraft.watermarkOpacity * 100)} onChange={(event) => setSettingsDraft({ ...settingsDraft, watermarkOpacity: Number(event.target.value) / 100 })} /></Field></div>
          <p className="mt-3 text-xs text-muted-foreground">The mark is centered, diagonal, and rendered behind invoice content on every PDF page.</p>
        </div>
        <Field label="Default style"><select className="native-control" value={settingsDraft.invoiceStyle} onChange={(event) => setSettingsDraft({ ...settingsDraft, invoiceStyle: event.target.value as InvoiceSettings["invoiceStyle"] })}><option>Creative</option><option>Neutral</option><option>Professional</option><option>Modern Classic</option></select></Field>
        <Field label="Business display name"><Input value={settingsDraft.businessName} onChange={(event) => setSettingsDraft({ ...settingsDraft, businessName: event.target.value })} /></Field>
        <Field label="Legal name (optional)"><Input value={settingsDraft.legalName} onChange={(event) => setSettingsDraft({ ...settingsDraft, legalName: event.target.value })} /></Field>
        <Field label="Phone"><Input value={settingsDraft.phone} onChange={(event) => setSettingsDraft({ ...settingsDraft, phone: event.target.value })} /></Field>
        <Field label="Email"><Input type="email" value={settingsDraft.email} onChange={(event) => setSettingsDraft({ ...settingsDraft, email: event.target.value })} /></Field>
        <Field label="Invoice prefix"><Input value={settingsDraft.invoicePrefix} onChange={(event) => setSettingsDraft({ ...settingsDraft, invoicePrefix: event.target.value.toUpperCase() })} /></Field>
        <Field label="Next sequence"><EditableNumberInput min="1" value={settingsDraft.nextInvoiceSequence} emptyValue={1} onValueChange={(nextInvoiceSequence) => setSettingsDraft({ ...settingsDraft, nextInvoiceSequence })} /></Field>
        <Field label="Number padding"><EditableNumberInput min="2" max="8" value={settingsDraft.invoiceNumberPadding} emptyValue={4} onValueChange={(invoiceNumberPadding) => setSettingsDraft({ ...settingsDraft, invoiceNumberPadding })} /></Field>
        <Field label="Default payment terms"><Input value={settingsDraft.defaultPaymentTerms} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultPaymentTerms: event.target.value })} /></Field>
        <div className="rounded-xl bg-muted p-4 text-sm sm:col-span-2"><p className="font-semibold">Next number preview</p><p className="mt-1 font-mono text-muted-foreground">{settingsDraft.invoicePrefix || "INV"}-{new Date().getFullYear()}-{String(Math.max(settingsDraft.nextInvoiceSequence || 1, 1)).padStart(settingsDraft.invoiceNumberPadding || 4, "0")}</p><p className="mt-2 text-xs text-muted-foreground">Changing this continues a series; it never renumbers issued invoices.</p></div>
        <div className="sm:col-span-2"><Field label="Address"><Textarea rows={2} value={settingsDraft.address} onChange={(event) => setSettingsDraft({ ...settingsDraft, address: event.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Payment instructions"><Textarea rows={3} value={settingsDraft.paymentInstructions} onChange={(event) => setSettingsDraft({ ...settingsDraft, paymentInstructions: event.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Default notes"><Textarea rows={3} value={settingsDraft.defaultNotes} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultNotes: event.target.value })} /></Field></div>
        <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><input type="checkbox" checked={settingsDraft.showSchedules} onChange={(event) => setSettingsDraft({ ...settingsDraft, showSchedules: event.target.checked })} className="size-4" /> <span className="text-sm font-semibold">Show schedules on invoices</span></label>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button><Button onClick={saveSettings}>Save settings</Button></DialogFooter>
    </DialogContent>
  </Dialog>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-2">{label}</Label>{children}</div>; }

function AssetField({ label, value, onUpload, onRemove }: { label: string; value: string; onUpload: (file?: File) => void; onRemove: () => void }) { return <div><Label>{label}</Label><div className="mt-2 flex items-center gap-3">{value && <img src={value} alt="" className="size-16 rounded-lg border border-border object-contain p-1" />}<div className="min-w-0 flex-1"><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload(event.target.files?.[0])} />{value && <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={onRemove}>Remove</Button>}</div></div></div>; }

function InvoiceEditor({ invoice, customers, onClose, onSave }: { invoice: Invoice | null; customers: Array<{ id: string; name: string; phone: string; email: string }>; onClose: () => void; onSave: (invoice: Invoice) => void }) {
  const [draft, setDraft] = useState<Invoice | null>(invoice);
  if (!draft) return null;
  const currentDraft = draft;
  const totals = invoiceTotals(currentDraft);
  const editorDarkTotal = currentDraft.invoiceStyle === "Modern Classic" || currentDraft.invoiceStyle === "Professional";
  const editorCreativeTotal = currentDraft.invoiceStyle === "Creative";
  const clientItems = customers.map((client) => ({ value: client.id, label: client.name, description: [client.phone, client.email].filter(Boolean).join(" · ") || "No contact details", keywords: [client.name, client.phone, client.email].join(" ") }));
  function updateItem(id: string, changes: Partial<InvoiceLineItem>) { setDraft({ ...currentDraft, lineItems: currentDraft.lineItems.map((item) => item.id === id ? { ...item, ...changes } : item) }); }
  function chooseClient(id: string) { const client = customers.find((item) => item.id === id); setDraft({ ...currentDraft, clientId: client?.id ?? null, clientName: client?.name ?? currentDraft.clientName, clientPhone: client?.phone ?? "", clientEmail: client?.email ?? "" }); }
  async function uploadDraftWatermark(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size <= 0 || file.size > 8 * 1024 * 1024) return notify.error("Use a PNG, JPG, or WebP image up to 8 MB.");
    try {
      if (isValidationModeEnabled()) {
        const uploaded = await validationClient.uploadMedia(file, "invoice-watermark");
        setDraft({ ...currentDraft, watermarkImage: uploaded.url, watermarkEnabled: true });
        return;
      }
      const value = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => reject(new Error("Could not read that image.")); reader.readAsDataURL(file); });
      setDraft({ ...currentDraft, watermarkImage: value, watermarkEnabled: true });
    } catch (error) { notify.error(error instanceof Error ? error.message : "Could not upload that image."); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] sm:max-w-3xl"><DialogHeader><DialogTitle>{draft.bookingId ? "Booking invoice" : "Custom invoice"}</DialogTitle><DialogDescription>{draft.bookingId ? "Booking details are prefilled. Changes here do not change the booking." : "A custom invoice does not create a Booking, Payment, or Income record."}</DialogDescription></DialogHeader><div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-2">{customers.length > 0 && !draft.bookingId && <Field label="Existing client"><SearchableSelect label="Invoice client" value={draft.clientId ?? ""} onValueChange={chooseClient} items={clientItems} placeholder="Enter manually" searchPlaceholder="Search name, phone, or email…" /></Field>}<Field label="Client name"><Input value={draft.clientName} onChange={(event) => setDraft({ ...draft, clientName: event.target.value })} /></Field><Field label="Client phone"><Input value={draft.clientPhone} onChange={(event) => setDraft({ ...draft, clientPhone: event.target.value })} /></Field><Field label="Client email"><Input type="email" value={draft.clientEmail} onChange={(event) => setDraft({ ...draft, clientEmail: event.target.value })} /></Field><Field label="Invoice date"><Input type="date" value={draft.invoiceDate} onChange={(event) => setDraft({ ...draft, invoiceDate: event.target.value })} /></Field><Field label="Due date"><Input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></Field></div>
    <section>
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Line items</h3><Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, lineItems: [...draft.lineItems, newLineItem()] })}><Plus className="size-4" /> Add item</Button></div>
      <div className="mt-3 space-y-3">{draft.lineItems.map((item, index) => (
        <article key={item.id} className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Item {index + 1}</p>{draft.lineItems.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => setDraft({ ...draft, lineItems: draft.lineItems.filter((candidate) => candidate.id !== item.id) })}>Remove</Button>}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Item"><Input value={item.item} onChange={(event) => updateItem(item.id, { item: event.target.value })} /></Field>
            <Field label="Description (optional)"><Input value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} /></Field>
            <Field label="Quantity"><EditableNumberInput min="0.01" step="0.01" emptyValue={1} value={item.quantity} onValueChange={(quantity) => updateItem(item.id, { quantity })} /></Field>
            <Field label="Unit price"><EditableNumberInput min="0" step="1000" value={item.unitPrice} onValueChange={(unitPrice) => updateItem(item.id, { unitPrice })} /></Field>
          </div>
          <p className="mt-3 text-right text-sm font-semibold">Amount: {formatRupiah(item.quantity * item.unitPrice)}</p>
        </article>
      ))}</div>
    </section>
    <section className="rounded-2xl border border-border p-4 sm:p-5">
      <h3 className="font-semibold">Pricing adjustments</h3>
      <div className="mt-4 rounded-xl bg-muted/40 p-4">
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" className="size-4" checked={draft.watermarkEnabled} disabled={!draft.watermarkImage} onChange={(event) => setDraft({ ...draft, watermarkEnabled: event.target.checked })} /><span className="text-sm font-semibold">Show watermark on this invoice</span></label>
        <div className="mt-3 grid gap-4 sm:grid-cols-2"><AssetField label="Watermark image" value={draft.watermarkImage ?? ""} onUpload={(file) => void uploadDraftWatermark(file)} onRemove={() => setDraft({ ...draft, watermarkImage: "", watermarkEnabled: false })} /><Field label={`Opacity (${Math.round((draft.watermarkOpacity ?? 0.08) * 100)}%)`}><Input type="range" min="6" max="20" step="1" value={Math.round((draft.watermarkOpacity ?? 0.08) * 100)} onChange={(event) => setDraft({ ...draft, watermarkOpacity: Number(event.target.value) / 100 })} /></Field></div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Discount"><select className="native-control" value={draft.discountMode} onChange={(event) => setDraft({ ...draft, discountMode: event.target.value as Invoice["discountMode"], discountValue: event.target.value === "none" ? 0 : draft.discountValue })}><option value="none">No discount</option><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></Field>
        {draft.discountMode !== "none" && <Field label={draft.discountMode === "percentage" ? "Discount value (%)" : "Discount value"}><EditableNumberInput min="0" max={draft.discountMode === "percentage" ? 100 : undefined} step={draft.discountMode === "percentage" ? "0.1" : "1000"} value={draft.discountValue} onValueChange={(discountValue) => setDraft({ ...draft, discountValue, discount: draft.discountMode === "fixed" ? discountValue : 0 })} /></Field>}
        <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><input type="checkbox" className="size-4" checked={draft.taxEnabled ?? ((draft.taxPercent ?? 0) > 0 || draft.tax > 0)} onChange={(event) => setDraft({ ...draft, taxEnabled: event.target.checked })} /><span className="text-sm font-semibold">Add tax or withholding</span></label>
        {(draft.taxEnabled ?? ((draft.taxPercent ?? 0) > 0 || draft.tax > 0)) && <>
          <Field label="Tax name"><select className="native-control" value={["PPN", "VAT", "PPh", "Sales Tax", "Service Tax"].includes(draft.taxName ?? "") ? draft.taxName : "Other"} onChange={(event) => setDraft({ ...draft, taxName: event.target.value === "Other" ? "" : event.target.value })}><option>PPN</option><option>VAT</option><option>PPh</option><option>Sales Tax</option><option>Service Tax</option><option>Other</option></select></Field>
          <Field label="Tax label"><Input value={draft.taxName ?? ""} placeholder="e.g. PPN" onChange={(event) => setDraft({ ...draft, taxName: event.target.value })} /></Field>
          <Field label="Calculation"><select className="native-control" value={draft.taxMode ?? "percentage"} onChange={(event) => setDraft({ ...draft, taxMode: event.target.value as "percentage" | "fixed" })}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option></select></Field>
          <Field label={(draft.taxMode ?? "percentage") === "percentage" ? "Tax value (%)" : "Tax value"}><EditableNumberInput min="0" max={(draft.taxMode ?? "percentage") === "percentage" ? 100 : undefined} step={(draft.taxMode ?? "percentage") === "percentage" ? "0.1" : "1000"} value={draft.taxValue ?? draft.taxPercent ?? 0} onValueChange={(taxValue) => setDraft({ ...draft, taxValue, taxPercent: (draft.taxMode ?? "percentage") === "percentage" ? taxValue : 0, tax: 0 })} /></Field>
          <Field label="Treatment"><select className="native-control" value={draft.taxTreatment ?? "added"} onChange={(event) => setDraft({ ...draft, taxTreatment: event.target.value as "added" | "deducted" })}><option value="added">Add to total</option><option value="deducted">Deduct from total</option></select></Field>
        </>}
        <Field label="Invoice style"><select className="native-control" value={draft.invoiceStyle} onChange={(event) => setDraft({ ...draft, invoiceStyle: event.target.value as Invoice["invoiceStyle"] })}><option>Creative</option><option>Neutral</option><option>Professional</option><option>Modern Classic</option></select></Field>
      </div>
    </section>
    <section><h3 className="font-semibold">Summary</h3><dl className={`mt-4 overflow-hidden border bg-white ${currentDraft.invoiceStyle === "Modern Classic" ? "rounded-none border-slate-950" : editorCreativeTotal ? "rounded-xl border-primary/40" : "rounded-xl border-slate-200"}`}><div className="space-y-2 px-5 py-4 text-sm"><div className="flex justify-between gap-8"><dt className="text-slate-500">Subtotal</dt><dd className="font-medium tabular-nums">{formatRupiah(totals.subtotal)}</dd></div>{totals.discount > 0 && <div className="flex justify-between gap-8"><dt className="text-slate-500">Discount{draft.discountMode === "percentage" ? ` (${draft.discountValue}%)` : ""}</dt><dd className="font-medium tabular-nums">-{formatRupiah(totals.discount)}</dd></div>}{totals.tax > 0 && <div className="flex justify-between gap-8"><dt className="text-slate-500">{invoiceTaxLabel(draft)}</dt><dd className="font-medium tabular-nums">{draft.taxTreatment === "deducted" ? "-" : ""}{formatRupiah(totals.tax)}</dd></div>}</div><div className={`flex items-baseline justify-between gap-8 px-5 py-4 ${editorDarkTotal ? "bg-slate-950 text-white" : editorCreativeTotal ? "border-l-4 border-primary bg-[#f7eff4] text-slate-950" : "bg-slate-50 text-slate-950"}`}><dt className="font-black">Grand total</dt><dd className="text-xl font-black tabular-nums">{formatRupiah(totals.total)}</dd></div></dl></section>
    <Field label="Payment instructions"><Textarea rows={3} value={draft.paymentInstructions} onChange={(event) => setDraft({ ...draft, paymentInstructions: event.target.value })} /></Field><Field label="Notes"><Textarea rows={4} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>{draft.bookingId && draft.schedules.length > 0 && <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={draft.showSchedules} onChange={(event) => setDraft({ ...draft, showSchedules: event.target.checked })} className="size-4" /><span className="text-sm font-semibold">Show {draft.schedules.length} {draft.schedules.length === 1 ? "schedule" : "schedules"} on invoice</span></label>}
  </div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => onSave(draft)}>Save draft</Button></DialogFooter></DialogContent></Dialog>;
}
