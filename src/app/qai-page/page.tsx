/* eslint-disable @next/next/no-img-element -- Validation-only owner-provided data URLs cannot use the Next image optimizer. */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Clipboard, Eye, MessageCircle, Plus, Save, Trash2, X } from "lucide-react";

import BookingDialog from "@/features/booking/components/BookingDialog";
import { loadBookingQuestionnaire } from "@/features/booking-questionnaire/questionnaireRepository";
import type { BookingFormValues } from "@/features/booking/types";
import { zonedDateTimeToIso } from "@/features/booking/utils/bookingSessions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { uniqueStrongClientMatch } from "@/features/customer/domain/clientIdentity";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { useServices } from "@/features/service/hooks/useServices";
import { notify } from "@/lib/notifications";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import QaiPageRenderer from "@/features/qai-page/components/QaiPageRenderer";
import PortfolioEditor from "@/features/qai-page/components/PortfolioEditor";
import BookingRequestList from "@/features/qai-page/components/BookingRequestList";
import { rejectionWhatsAppUrl, renderRejectionMessage } from "@/features/qai-page/rejectionMessage";
import { normalizeSocialProfile } from "@/features/qai-page/socialProfiles";
import {
  defaultQaiPage,
  normalizeSlug,
  publicActionLabel,
  publicPriceLabel,
  requestToBookingValues,
  validationClient,
  qaiPageThemeIssues,
  QAI_PAGE_BUTTON_STYLES,
  QAI_PAGE_DENSITIES,
  QAI_PAGE_TEMPLATES,
  QAI_PAGE_TONES,
  QAI_PAGE_THEME_PRESETS,
  QAI_PAGE_TYPOGRAPHY,
  type InstantSlot,
  type PublicRequest,
  type PublicService,
  type QaiPageConfig,
} from "@/features/qai-page/validation";

const QAI_PAGE_TABS = ["Page", "Design", "Portfolio", "Services", "Booking", "Requests", "Preview"] as const;
type Tab = (typeof QAI_PAGE_TABS)[number];

function isTab(value: string | null): value is Tab {
  return value !== null && QAI_PAGE_TABS.some((tab) => tab === value);
}

const TEMPLATE_COPY: Record<(typeof QAI_PAGE_TEMPLATES)[number], { name: string; description: string }> = {
  Muse: { name: "Hero Gallery", description: "Immersive cover with editorial work" },
  Studio: { name: "Editorial Grid", description: "Split profile and structured gallery" },
  Signature: { name: "Minimal Studio", description: "Quiet typography and generous space" },
  Professional: { name: "Service Focus", description: "Direct profile and operational services" },
  Warm: { name: "Full Portfolio", description: "Rich cover and asymmetric showcase" },
  Editorial: { name: "Magazine Portfolio", description: "Masthead profile and rhythmic story grid" },
};

function dateInput(days = 0) { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
async function readImage(file: File | undefined, kind: "page-logo" | "page-cover" | "portfolio", onLoad: (value: string) => void) {
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8_000_000) return notify.error("Use a PNG, JPG, or WebP image up to 8 MB.");
  if (!isValidationModeEnabled()) { const reader = new FileReader(); reader.onload = () => onLoad(String(reader.result ?? "")); reader.readAsDataURL(file); return; }
  try { const uploaded = await validationClient.uploadMedia(file, kind); onLoad(uploaded.url); } catch (error) { notify.error(error instanceof Error ? error.message : "Could not upload that image."); }
}

function publicServiceFromRecord(service: (ReturnType<typeof useServices>)["services"][number], existing?: PublicService, position = 0): PublicService {
  return {
    serviceId: service.id,
    visible: existing?.visible ?? false,
    title: existing?.title ?? service.name,
    description: existing?.description ?? service.description,
    price: existing?.price ?? service.price,
    priceMode: existing?.priceMode ?? "Fixed price",
    actionMode: existing?.actionMode ?? "Booking request",
    durationMinutes: service.duration,
    defaultSessionCount: service.defaultSessionCount,
    locationPolicy: service.locationPolicy ?? "Client can choose",
    optionGroups: service.optionGroups ?? [],
    variants: service.variants ?? [],
    availability: service.availability ?? { mode: "Flexible", capacityMode: "One booking", defaultCapacity: 1, recurringTimes: [], datedSessions: [], overrides: [] },
    position: existing ? (existing.position || position) : position,
    featured: existing?.featured ?? false,
  };
}

export default function QaiPageOwner() {
  return (
    <Suspense fallback={<main className="min-h-screen"><div className="page-shell"><div className="surface-card min-h-64 animate-pulse" /></div></main>}>
      <QaiPageOwnerContent />
    </Suspense>
  );
}

function QaiPageOwnerContent() {
  const searchParams = useSearchParams();
  const bookingData = useBookings(); const customerData = useCustomers(); const serviceData = useServices(); const paymentData = usePayments(); const expenseData = useExpenses();
  const [tab, setTab] = useState<Tab>(() => {
    const requestedTab = searchParams.get("tab");
    return isTab(requestedTab) ? requestedTab : "Page";
  });
  const [page, setPage] = useState<QaiPageConfig>(defaultQaiPage()); const [requests, setRequests] = useState<PublicRequest[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [activeRequest, setActiveRequest] = useState<PublicRequest | null>(null);
  const [bookingInitial, setBookingInitial] = useState<BookingFormValues | undefined>(); const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"Desktop" | "Mobile">("Desktop");
  const [requestFilter, setRequestFilter] = useState<"Pending" | "Accepted" | "Declined" | "All">("Pending");
  const [declineTarget, setDeclineTarget] = useState<PublicRequest | null>(null); const [declineMessage, setDeclineMessage] = useState(""); const [declinePending, setDeclinePending] = useState(false);
  const [slotDraft, setSlotDraft] = useState({ serviceId: "", date: dateInput(7), startTime: "09:00", endTime: "10:00", location: "" });

  const load = useCallback(async (refreshPage = true) => {
    try { const [store, questionnaire] = await Promise.all([validationClient.owner(), loadBookingQuestionnaire()]); const existing = store.pages.find((item) => item.businessId === "local-business"); if (refreshPage) setPage({ ...(existing ?? defaultQaiPage()), questionnaire }); setRequests(store.requests.filter((item) => !existing || item.pageId === existing.id).sort((a, b) => b.submittedAt - a.submittedAt)); }
    catch (error) { notify.error(error instanceof Error ? error.message : "Could not load Qai Page data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const initial = window.setTimeout(() => { void load(); }, 0); const timer = window.setInterval(() => { void load(false); }, 4000); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);

  const configuredServices = useMemo(() => serviceData.services.map((service, position) => publicServiceFromRecord(service, page.services.find((item) => item.serviceId === service.id), position)).sort((left, right) => left.position - right.position), [serviceData.services, page.services]);
  const pendingCount = requests.filter((item) => item.status === "Pending" || (item.type === "Instant booking" && !item.bookingId)).length;
  const themeIssues = qaiPageThemeIssues(page.style);
  const tiktokInvalid = page.tiktok.trim().length > 0 && normalizeSocialProfile("tiktok", page.tiktok) === null;
  function updateService(service: PublicService) { setPage((current) => ({ ...current, services: current.services.some((item) => item.serviceId === service.serviceId) ? current.services.map((item) => item.serviceId === service.serviceId ? service : item) : [...current.services, service] })); }
  function movePublicService(serviceId: string, direction: -1 | 1) {
    const ordered = [...configuredServices].sort((left, right) => left.position - right.position);
    const index = ordered.findIndex((service) => service.serviceId === serviceId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setPage((current) => ({ ...current, services: ordered.map((service, position) => ({ ...service, position })) }));
  }
  function applyTone(tone: QaiPageConfig["style"]["tone"]) {
    setPage((current) => ({
      ...current,
      style: tone === "Dark"
        ? { ...current.style, tone, backgroundColor: "#0B1119", surfaceColor: "#121A24", textColor: "#F8FAFC", mutedTextColor: "#B6C0CE", borderColor: "#2A3543" }
        : tone === "Light"
          ? { ...current.style, tone, backgroundColor: "#F7F8FC", surfaceColor: "#FFFFFF", textColor: "#111A31", mutedTextColor: "#667085", borderColor: "#D7DCE5" }
          : { ...current.style, tone },
    }));
  }
  function movePageSection(section: QaiPageConfig["style"]["sectionOrder"][number], direction: -1 | 1) { setPage((current) => { const order = [...current.style.sectionOrder]; const index = order.indexOf(section); const target = index + direction; if (index < 0 || target < 0 || target >= order.length) return current; [order[index], order[target]] = [order[target], order[index]]; return { ...current, style: { ...current.style, sectionOrder: order } }; }); }
  async function removePortfolio(id: string, imageUrl: string) { setPage((current) => ({ ...current, portfolio: current.portfolio.filter((item) => item.id !== id).map((item, position) => ({ ...item, position })) })); if (!isValidationModeEnabled()) return; try { await validationClient.deleteMedia(imageUrl); } catch { notify.error("The item was removed from this draft, but its image could not be deleted."); } }
  async function savePage() {
    const slug = normalizeSlug(page.slug); if (!slug) return notify.error("Enter a page address using letters or numbers.");
    if (tiktokInvalid) return notify.error("Enter a TikTok username or profile link.");
    setSaving(true); try { const saved = await validationClient.savePage({ ...page, slug, services: configuredServices, timezone: bookingData.timezone, updatedAt: Date.now() }); setPage(saved); notify.success("Qai Page saved."); }
    catch (error) { notify.error(error instanceof Error ? error.message : "Could not save Qai Page."); } finally { setSaving(false); }
  }
  async function copyLink() { const url = `${window.location.origin}/q/${page.slug}`; await navigator.clipboard.writeText(url); notify.success("Page link copied."); }
  function addSlot() {
    if (!slotDraft.serviceId || !slotDraft.date || !slotDraft.startTime || !slotDraft.endTime) return notify.error("Choose a service, date, start time, and end time.");
    const startAt = zonedDateTimeToIso(slotDraft.date, slotDraft.startTime, bookingData.timezone); let endAt = zonedDateTimeToIso(slotDraft.date, slotDraft.endTime, bookingData.timezone);
    if (Date.parse(endAt) <= Date.parse(startAt)) { const end = new Date(endAt); end.setUTCDate(end.getUTCDate() + 1); endAt = end.toISOString(); }
    const slot: InstantSlot = { id: crypto.randomUUID(), serviceId: slotDraft.serviceId, startAt, endAt, location: slotDraft.location, status: "Available", requestId: null };
    setPage((current) => ({ ...current, slots: [...current.slots, slot] }));
  }
  async function ensureClient(request: PublicRequest) {
    const exact = uniqueStrongClientMatch({ name: request.clientName, phone: request.whatsapp, email: request.email, instagram: request.instagram }, customerData.customers);
    return exact ?? customerData.createCustomerAndReturn({ name: request.clientName, phone: request.whatsapp, email: request.email, instagram: request.instagram, notes: "Created from a Qai Page request." });
  }
  function bookingValues(request: PublicRequest, customerId: string): BookingFormValues | null {
    const service = serviceData.services.find((item) => item.id === request.serviceId); if (!service) return null;
    return requestToBookingValues(request, service, customerId, dateInput(7));
  }
  async function accept(request: PublicRequest) {
    if (request.bookingId) return notify.info("This request already has a booking.");
    const client = await ensureClient(request); if (!client) return notify.error("Could not create or reuse the client.");
    const values = bookingValues(request, client.id); if (!values) return notify.error("The original service is no longer available.");
    try { await validationClient.claimRequest(request.id); } catch (error) { return notify.error(error instanceof Error ? error.message : "That time is no longer available."); }
    const booking = await bookingData.createBookingAndReturn({ requestId: `qai-page:${request.id}`, booking: values, initialPayment: null });
    if (!booking) { await validationClient.updateRequest(request.id, "Pending", null, client.id).catch(() => undefined); return notify.error("Could not create the booking."); }
    try { await validationClient.updateRequest(request.id, "Accepted", booking.id, client.id); await load(); notify.success("Request accepted and booking created."); } catch (error) { notify.error(error instanceof Error ? error.message : "Booking created, but the request could not be updated."); }
  }
  async function editAndAccept(request: PublicRequest) {
    if (request.bookingId) return notify.info("This request already has a booking.");
    const client = await ensureClient(request); if (!client) return notify.error("Could not create or reuse the client.");
    const values = bookingValues(request, client.id); if (!values) return notify.error("The original service is no longer available.");
    setActiveRequest(request); setBookingInitial(values); setBookingDialogOpen(true);
  }
  function decline(request: PublicRequest) {
    setDeclineTarget(request);
    setDeclineMessage(renderRejectionMessage(page.messages.rejectionWhatsappTemplate, { clientName: request.clientName, serviceName: request.serviceName, businessName: page.businessName }));
  }
  async function confirmDecline(openWhatsApp: boolean) {
    if (!declineTarget) return;
    const whatsApp = rejectionWhatsAppUrl(declineTarget.whatsapp, declineMessage);
    if (openWhatsApp && !whatsApp) return notify.error("This request does not have a valid WhatsApp number.");
    setDeclinePending(true);
    try {
      await validationClient.updateRequest(declineTarget.id, "Declined", null, declineTarget.clientId);
      if (openWhatsApp && whatsApp) window.open(whatsApp, "_blank", "noopener,noreferrer");
      setDeclineTarget(null);
      await load();
      notify.success(openWhatsApp ? "Request declined. WhatsApp opened for your review." : "Request declined.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not decline the request.");
    } finally {
      setDeclinePending(false);
    }
  }

  if (loading) return <main className="min-h-screen"><div className="page-shell"><div className="surface-card min-h-64 animate-pulse" /></div></main>;
  return <main className="min-h-screen"><div className="page-shell">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="page-title">Qai Page</h1><p className="mt-2 text-sm text-muted-foreground sm:text-base">Create a focused business storefront powered by your existing Qai records.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copyLink()}><Clipboard className="size-4" /> Copy link</Button><Button onClick={() => void savePage()} disabled={saving}><Save className="size-4" /> {saving ? "Publishing…" : "Publish changes"}</Button></div></header>
    <nav className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1 sm:flex" aria-label="Qai Page sections">{(["Page", "Design", "Portfolio", "Services", "Booking", "Requests", "Preview"] as Tab[]).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-11 min-w-0 rounded-lg px-1 text-[11px] font-semibold sm:px-4 sm:text-sm ${tab === item ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>{item}{item === "Requests" && pendingCount > 0 ? ` (${pendingCount})` : ""}</button>)}</nav>
    <div className={tab === "Requests" || tab === "Preview" ? "min-w-0" : "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,.82fr)_minmax(30rem,1.18fr)] xl:items-start"}>
    <div className="min-w-0 space-y-6">
    {tab === "Booking" && <section className="surface-card p-5 sm:p-6"><h2 className="section-title">Booking communication</h2><p className="mt-1 text-sm text-muted-foreground">Customize the optional WhatsApp message offered after declining a request. Qai never sends it automatically.</p><div className="mt-6 max-w-3xl"><Field label="Decline message"><Textarea rows={7} maxLength={4000} value={page.messages.rejectionWhatsappTemplate} onChange={(event) => setPage((current) => ({ ...current, messages: { ...current.messages, rejectionWhatsappTemplate: event.target.value } }))} /></Field><p className="mt-2 text-xs leading-5 text-muted-foreground">Available placeholders: {"{client_name}"}, {"{service_name}"}, {"{business_name}"}.</p></div></section>}
    {tab === "Design" && <section className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="section-title">Theme palette</h2><p className="mt-1 text-sm text-muted-foreground">Controlled colors keep every template readable and consistent.</p></div><Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => ({ ...current, style: defaultQaiPage().style }))}>Reset theme</Button></div>
      <div className="mt-5 flex flex-wrap gap-2">{Object.entries(QAI_PAGE_THEME_PRESETS).map(([name, colors]) => <Button key={name} type="button" variant="outline" size="sm" onClick={() => setPage((current) => ({ ...current, style: { ...current.style, ...colors } }))}>{name}</Button>)}</div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{([["Page", "backgroundColor"], ["Surface", "surfaceColor"], ["Text", "textColor"], ["Muted text", "mutedTextColor"], ["Accent", "accentColor"], ["Button", "buttonBackgroundColor"], ["Button text", "buttonTextColor"], ["Border", "borderColor"]] as const).map(([label, key]) => <Field key={key} label={label}><Input type="color" className="h-11 p-1" value={page.style[key]} onChange={(event) => setPage((current) => ({ ...current, style: { ...current.style, [key]: event.target.value } }))} /></Field>)}</div>
      <div className="mt-6 grid gap-5 sm:grid-cols-3"><Field label="Tone"><select className="native-control" value={page.style.tone} onChange={(event) => applyTone(event.target.value as QaiPageConfig["style"]["tone"])}>{QAI_PAGE_TONES.map((tone) => <option key={tone}>{tone}</option>)}</select></Field><Field label="Button style"><select className="native-control" value={page.style.buttonStyle} onChange={(event) => setPage((current) => ({ ...current, style: { ...current.style, buttonStyle: event.target.value as QaiPageConfig["style"]["buttonStyle"] } }))}>{QAI_PAGE_BUTTON_STYLES.map((style) => <option key={style}>{style}</option>)}</select></Field><label className="flex min-h-11 items-center gap-3 self-end rounded-lg border border-border px-3 text-sm font-semibold"><input type="checkbox" checked={page.style.showAbout} onChange={(event) => setPage((current) => ({ ...current, style: { ...current.style, showAbout: event.target.checked } }))} />Show About section</label></div>
      {themeIssues.length > 0 ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-semibold text-amber-950">Contrast needs attention</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{themeIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div> : <p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Theme contrast passes Qai’s readability guardrails.</p>}
    </section>}
    {tab === "Page" && <section className="surface-card p-5 sm:p-6"><h2 className="section-title">Public profile</h2><p className="mt-1 text-sm text-muted-foreground">Keep the page short and easy for customers to understand.</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><Field label="Business logo/photo"><div className="flex items-center gap-3">{page.logo && <img src={page.logo} alt="Page logo preview" className="size-16 rounded-xl border border-border object-cover" />}<Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void readImage(event.target.files?.[0], "page-logo", (logo) => setPage((current) => ({ ...current, logo })))} /></div></Field><Field label="Cover image"><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void readImage(event.target.files?.[0], "page-cover", (coverImage) => setPage((current) => ({ ...current, coverImage })))} /></Field><Field label="Business name"><Input value={page.businessName} onChange={(event) => setPage({ ...page, businessName: event.target.value })} /></Field><Field label="Page address"><div className="flex items-center rounded-lg border border-border bg-card pl-3 text-sm text-muted-foreground"><span>/q/</span><Input className="border-0 shadow-none focus-visible:ring-0" value={page.slug} onChange={(event) => setPage({ ...page, slug: normalizeSlug(event.target.value) })} /></div></Field><div className="sm:col-span-2"><Field label="Short description"><Textarea rows={3} value={page.shortDescription} onChange={(event) => setPage({ ...page, shortDescription: event.target.value })} /></Field></div><Field label="Location"><Input value={page.location} onChange={(event) => setPage({ ...page, location: event.target.value })} /></Field><Field label="WhatsApp"><Input inputMode="tel" value={page.whatsapp} onChange={(event) => setPage({ ...page, whatsapp: event.target.value })} /></Field><Field label="Email"><Input type="email" value={page.email} onChange={(event) => setPage({ ...page, email: event.target.value })} /></Field><Field label="Instagram"><Input aria-label="Instagram" value={page.instagram} placeholder="@username or profile link" onChange={(event) => setPage({ ...page, instagram: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="TikTok"><Input aria-label="TikTok" value={page.tiktok} placeholder="@username or profile link" aria-invalid={tiktokInvalid} aria-describedby={tiktokInvalid ? "qai-page-tiktok-error" : undefined} onChange={(event) => setPage({ ...page, tiktok: event.target.value })} /></Field>{tiktokInvalid && <p id="qai-page-tiktok-error" className="mt-1.5 text-sm font-medium text-destructive">Enter a TikTok username or profile link.</p>}</div></div><p className="mt-5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">{isValidationModeEnabled() ? "Your public profile, services, and selected work are saved to this remote validation workspace." : "Your public profile, services, and selected work are saved in this browser."}</p></section>}
    {tab === "Design" && <section className="space-y-6"><div className="surface-card p-5 sm:p-6"><h2 className="section-title">Template</h2><p className="mt-1 text-sm text-muted-foreground">Choose a controlled layout. Your services and operational data are never changed.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{QAI_PAGE_TEMPLATES.map((template) => <button key={template} type="button" aria-pressed={page.template === template} onClick={() => setPage({ ...page, template })} className={`min-h-28 rounded-xl border p-4 text-left ${page.template === template ? "border-primary bg-primary/8 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted"}`}><span className="font-semibold">{TEMPLATE_COPY[template].name}</span><span className="mt-2 block text-xs leading-5 text-muted-foreground">{TEMPLATE_COPY[template].description}</span></button>)}</div></div><div className="grid gap-6 lg:grid-cols-2"><section className="surface-card p-5 sm:p-6"><h2 className="section-title">Brand & colors</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Accent color"><Input type="color" className="h-11 p-1" value={page.style.accentColor} onChange={(event) => setPage({ ...page, style: { ...page.style, accentColor: event.target.value } })} /></Field><Field label="Page background"><Input type="color" className="h-11 p-1" value={page.style.backgroundColor} onChange={(event) => setPage({ ...page, style: { ...page.style, backgroundColor: event.target.value } })} /></Field></div></section><section className="surface-card p-5 sm:p-6"><h2 className="section-title">Typography & layout</h2><div className="mt-5 grid gap-5 sm:grid-cols-2"><Field label="Typography"><select className="native-control" value={page.style.typography} onChange={(event) => setPage({ ...page, style: { ...page.style, typography: event.target.value as QaiPageConfig["style"]["typography"] } })}>{QAI_PAGE_TYPOGRAPHY.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Spacing"><select className="native-control" value={page.style.density} onChange={(event) => setPage({ ...page, style: { ...page.style, density: event.target.value as QaiPageConfig["style"]["density"] } })}>{QAI_PAGE_DENSITIES.map((item) => <option key={item}>{item}</option>)}</select></Field></div></section></div><section className="surface-card p-5 sm:p-6"><h2 className="section-title">Sections</h2><p className="mt-1 text-sm text-muted-foreground">Show, hide, or reorder the controlled content sections.</p><div className="mt-5 space-y-2">{page.style.sectionOrder.map((section, index) => <div key={section} className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-3"><label className="mr-auto flex min-h-10 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={section === "portfolio" ? page.style.showPortfolio : page.style.showServices} onChange={(event) => setPage({ ...page, style: { ...page.style, ...(section === "portfolio" ? { showPortfolio: event.target.checked } : { showServices: event.target.checked }) } })} />{section === "portfolio" ? "Portfolio" : "Services"}</label><Button size="icon-sm" variant="outline" aria-label={`Move ${section} earlier`} disabled={index === 0} onClick={() => movePageSection(section, -1)}><ArrowUp className="size-4" /></Button><Button size="icon-sm" variant="outline" aria-label={`Move ${section} later`} disabled={index === page.style.sectionOrder.length - 1} onClick={() => movePageSection(section, 1)}><ArrowDown className="size-4" /></Button></div>)}<label className="flex min-h-11 items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold"><input type="checkbox" checked={page.style.showContact} onChange={(event) => setPage({ ...page, style: { ...page.style, showContact: event.target.checked } })} />Contact buttons</label></div></section></section>}
    {tab === "Portfolio" && <PortfolioEditor page={page} services={configuredServices} onChange={setPage} onUpload={(file) => new Promise((resolve) => { void readImage(file, "portfolio", resolve); })} onRemoveImage={removePortfolio} />}
    {tab === "Services" && <div className="space-y-4">
      <header><h2 className="section-title">Public services</h2><p className="mt-1 text-sm text-muted-foreground">Choose what customers can see and how each service accepts work.</p></header>
      {configuredServices.length === 0 ? (
        <div className="empty-state"><p className="empty-title">No services to publish</p><p className="mt-2 text-sm text-muted-foreground">Add a Service first, then return here.</p></div>
      ) : configuredServices.map((service) => (
        <article key={service.serviceId} className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="font-semibold">{service.title}</h3><p className="mt-1 text-sm text-muted-foreground">{publicPriceLabel(service)} · {publicActionLabel(service.actionMode)}{service.variants.length ? ` · ${service.variants.filter((variant) => variant.active).length} choices` : ""}</p></div><div className="flex flex-wrap items-center gap-2"><label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4" checked={service.featured} onChange={(event) => updateService({ ...service, featured: event.target.checked })} /> Featured</label><label className="flex min-h-10 items-center gap-2 text-sm font-semibold"><input type="checkbox" className="size-4" checked={service.visible} onChange={(event) => updateService({ ...service, visible: event.target.checked })} /> Show</label><Button type="button" size="icon-sm" variant="outline" aria-label={`Move ${service.title} earlier`} disabled={service.position === 0} onClick={() => movePublicService(service.serviceId, -1)}><ArrowUp className="size-4" /></Button><Button type="button" size="icon-sm" variant="outline" aria-label={`Move ${service.title} later`} disabled={service.position === configuredServices.length - 1} onClick={() => movePublicService(service.serviceId, 1)}><ArrowDown className="size-4" /></Button></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Public title"><Input value={service.title} onChange={(event) => updateService({ ...service, title: event.target.value })} /></Field>
            <Field label="Price"><EditableNumberInput min="0" inputMode="numeric" value={service.price} onValueChange={(price) => updateService({ ...service, price })} /></Field>
            <div className="sm:col-span-2"><Field label="Public description"><Textarea rows={3} value={service.description} onChange={(event) => updateService({ ...service, description: event.target.value })} /></Field></div>
            <Field label="Price display"><select className="native-control" value={service.priceMode} onChange={(event) => updateService({ ...service, priceMode: event.target.value as PublicService["priceMode"] })}><option>Fixed price</option><option>Starting from</option><option>Ask for price</option></select></Field>
            <Field label="Customer action"><select className="native-control" value={service.actionMode} onChange={(event) => updateService({ ...service, actionMode: event.target.value as PublicService["actionMode"] })}><option>Booking request</option><option>Inquiry</option><option>Instant booking</option></select></Field>
          </div>
        </article>
      ))}
      {configuredServices.some((item) => item.actionMode === "Instant booking") && <section className="surface-card p-5 sm:p-6"><h2 className="section-title">Instant booking times</h2><p className="mt-1 text-sm text-muted-foreground">Publish only times you are ready to confirm immediately.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><select className="native-control" value={slotDraft.serviceId} onChange={(event) => setSlotDraft({ ...slotDraft, serviceId: event.target.value })}><option value="">Choose service</option>{configuredServices.filter((item) => item.actionMode === "Instant booking").map((item) => <option key={item.serviceId} value={item.serviceId}>{item.title}</option>)}</select><Input type="date" value={slotDraft.date} onChange={(event) => setSlotDraft({ ...slotDraft, date: event.target.value })} /><Input type="time" value={slotDraft.startTime} onChange={(event) => setSlotDraft({ ...slotDraft, startTime: event.target.value })} /><Input type="time" value={slotDraft.endTime} onChange={(event) => setSlotDraft({ ...slotDraft, endTime: event.target.value })} /><Button type="button" onClick={addSlot}><Plus className="size-4" /> Add time</Button></div><Input className="mt-3" placeholder="Location (optional)" value={slotDraft.location} onChange={(event) => setSlotDraft({ ...slotDraft, location: event.target.value })} /><div className="mt-4 space-y-2">{page.slots.length === 0 ? <p className="text-sm text-muted-foreground">No available times right now.</p> : page.slots.map((slot) => { const service = configuredServices.find((item) => item.serviceId === slot.serviceId); return <div key={slot.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{service?.title ?? "Service"}</p><p className="mt-1 text-sm text-muted-foreground">{new Date(slot.startAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: bookingData.timezone })} · {slot.status}</p></div>{slot.status === "Available" && <Button variant="ghost" size="sm" onClick={() => setPage({ ...page, slots: page.slots.filter((item) => item.id !== slot.id) })}><Trash2 className="size-4" /> Remove</Button>}</div>; })}</div></section>}
    </div>}
    {tab === "Requests" && <BookingRequestList requests={requests} filter={requestFilter} onFilterChange={setRequestFilter} onRefresh={() => void load()} onAccept={(request) => void accept(request)} onReview={(request) => void editAndAccept(request)} onDecline={decline} />}
    {tab === "Preview" && <section className="surface-card overflow-hidden"><div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h2 className="section-title">Public preview</h2><p className="mt-1 text-sm text-muted-foreground">This uses the same renderer as the published page.</p></div><div className="flex flex-wrap gap-2"><div className="flex rounded-lg border border-border p-1">{(["Desktop", "Mobile"] as const).map((device) => <button type="button" key={device} aria-pressed={previewDevice === device} onClick={() => setPreviewDevice(device)} className={`min-h-9 rounded-md px-3 text-sm font-semibold ${previewDevice === device ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{device}</button>)}</div><Button render={<Link href={`/q/${page.slug}`} target="_blank" />}><Eye className="size-4" /> Open public page</Button></div></div><div className="max-h-[70rem] overflow-y-auto bg-muted p-0 sm:p-4"><div className={`mx-auto overflow-hidden bg-white transition-[max-width] ${previewDevice === "Mobile" ? "max-w-[390px] shadow-xl" : "max-w-none"}`}><QaiPageRenderer page={{ ...page, services: configuredServices }} services={configuredServices.filter((item) => item.visible)} portfolio={[...page.portfolio].filter((item) => item.visible).sort((a, b) => a.position - b.position)} preview /></div></div></section>}
    </div>
    {tab !== "Requests" && tab !== "Preview" && <aside className="hidden min-w-0 xl:sticky xl:top-6 xl:block"><section className="surface-card overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><p className="section-kicker">Live preview</p><p className="mt-1 text-sm font-semibold">Same renderer as your public page</p></div><Button type="button" size="sm" variant="outline" onClick={() => setTab("Preview")}><Eye className="size-4" /> Full preview</Button></div><div className="max-h-[calc(100dvh-10rem)] overflow-y-auto bg-muted p-3"><div className="overflow-hidden bg-white shadow-sm"><QaiPageRenderer page={{ ...page, services: configuredServices }} services={configuredServices.filter((item) => item.visible)} portfolio={[...page.portfolio].filter((item) => item.visible).sort((a, b) => a.position - b.position)} preview /></div></div></section></aside>}
    </div>
  </div>
  <BookingDialog open={bookingDialogOpen} booking={null} initialValues={bookingInitial} customers={customerData.customers} services={serviceData.services} payments={paymentData.payments} expenses={expenseData.expenses} timezone={bookingData.timezone} onClose={() => { setBookingDialogOpen(false); setActiveRequest(null); }} onCreate={async (command) => { if (!activeRequest) return false; try { await validationClient.claimRequest(activeRequest.id); } catch (error) { notify.error(error instanceof Error ? error.message : "That time is no longer available."); return false; } const booking = await bookingData.createBookingAndReturn({ ...command, requestId: `qai-page:${activeRequest.id}` }); if (!booking) { await validationClient.updateRequest(activeRequest.id, "Pending", null, command.booking.customerId).catch(() => undefined); return false; } try { await validationClient.updateRequest(activeRequest.id, "Accepted", booking.id, command.booking.customerId); setBookingDialogOpen(false); setActiveRequest(null); await load(); return true; } catch { return false; } }} onUpdate={async () => false} onAddPaymentClick={() => undefined} onEditPaymentClick={() => undefined} onDeletePayment={async () => false} onQuickCreateCustomer={customerData.createCustomerAndReturn} onQuickCreateService={serviceData.createServiceAndReturn} />
  {declineTarget && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !declinePending) setDeclineTarget(null); }}><section role="dialog" aria-modal="true" aria-labelledby="decline-request-heading" className="w-full max-w-xl rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 id="decline-request-heading" className="section-title">Decline {declineTarget.clientName}’s request?</h2><p className="mt-1 text-sm text-muted-foreground">The request stays in history. WhatsApp is optional and never sent automatically.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Close decline dialog" disabled={declinePending} onClick={() => setDeclineTarget(null)}><X className="size-5" /></Button></div><div className="mt-5"><Field label="WhatsApp message"><Textarea rows={8} value={declineMessage} onChange={(event) => setDeclineMessage(event.target.value)} /></Field></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={declinePending} onClick={() => setDeclineTarget(null)}>Cancel</Button><Button type="button" variant="outline" disabled={declinePending} onClick={() => void confirmDecline(false)}>Decline only</Button><Button type="button" variant="destructive" disabled={declinePending || !rejectionWhatsAppUrl(declineTarget.whatsapp, declineMessage)} onClick={() => void confirmDecline(true)}><MessageCircle className="size-4" />Decline &amp; open WhatsApp</Button></div></section></div>}
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><Label className="mb-2">{label}</Label>{children}</div>; }
