"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileSpreadsheet } from "lucide-react";

import DataErrorState from "@/components/system/DataErrorState";
import PageSkeleton from "@/components/system/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { getInvoiceSettings, invoiceRepository } from "@/features/invoice/invoice";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { downloadFinancialReport } from "@/features/reports/excelExport";
import {
  buildFinancialReport,
  type FinancialReport,
  type ReportPeriodPreset,
} from "@/features/reports/financialReport";
import { exportFinancialReportToGoogleSheets } from "@/features/reports/googleSheetsExport";
import { buildFinancialReportInsights } from "@/features/reports/reportInsights";
import ReportPeriodSelector from "@/features/reports/ReportPeriodSelector";
import { useServices } from "@/features/service/hooks/useServices";
import { notify } from "@/lib/notifications";
import { getActiveBusinessContext, type ActiveBusinessContext } from "@/lib/supabase/cloudRepositories";
import { isCloudModeEnabled } from "@/lib/supabase/config";

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function SummaryCard({ label, value, detail, tone = "default" }: { label: string; value: string; detail: string; tone?: "default" | "positive" | "warning" }) {
  const toneClass = tone === "positive" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-foreground";
  return <article className="surface-card min-w-0 p-4 sm:p-5"><p className="text-sm font-medium text-muted-foreground">{label}</p><p className={`mt-3 break-words text-xl font-bold tabular-nums sm:text-2xl ${toneClass}`}>{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p></article>;
}

function Breakdown({ title, subtitle, rows, currency, money = true }: { title: string; subtitle: string; rows: Array<{ label: string; value: number }>; currency: string; money?: boolean }) {
  const maximum = Math.max(...rows.map((row) => row.value), 1);
  return <section className="surface-card p-5 sm:p-6"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>{rows.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No activity in this period.</p> : <div className="mt-6 space-y-4">{rows.map((row) => <div key={row.label}><div className="flex items-center justify-between gap-4 text-sm"><span className="min-w-0 truncate font-medium">{row.label}</span><strong className="shrink-0 tabular-nums">{money ? formatMoney(row.value, currency) : row.value.toLocaleString("en-US")}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (row.value / maximum) * 100)}%` }} /></div></div>)}</div>}</section>;
}

export default function ReportsPage() {
  const bookingData = useBookings();
  const customerData = useCustomers();
  const serviceData = useServices();
  const paymentData = usePayments();
  const expenseData = useExpenses();
  const categoryData = useExpenseCategories();
  const [preset, setPreset] = useState<ReportPeriodPreset>(() => {
    if (typeof window === "undefined") return "this-month";
    const requested = new URLSearchParams(window.location.search).get("preset") as ReportPeriodPreset | null;
    return requested && ["this-month", "last-month", "specific-month", "this-year", "all-time", "custom"].includes(requested) ? requested : "this-month";
  });
  const [selectedMonth, setSelectedMonth] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("month") ?? "");
  const [customFrom, setCustomFrom] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`);
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [cloudBusiness, setCloudBusiness] = useState<ActiveBusinessContext | null>(null);
  const [exporting, setExporting] = useState<"excel" | "sheets" | null>(null);
  const [sheetsExport, setSheetsExport] = useState<{ url: string; periodLabel: string } | null>(null);
  const cloudMode = isCloudModeEnabled();
  const business = useMemo<ActiveBusinessContext | null>(() => cloudMode ? cloudBusiness : ({ businessId: "local", businessName: getInvoiceSettings().businessName, currency: "IDR", timezone: bookingData.timezone }), [cloudMode, cloudBusiness, bookingData.timezone]);

  useEffect(() => {
    let active = true;
    if (!cloudMode) return () => { active = false; };
    void getActiveBusinessContext().then((context) => { if (active) setCloudBusiness(context); }).catch(() => { if (active) setCloudBusiness(null); });
    return () => { active = false; };
  }, [cloudMode]);

  const report = useMemo<FinancialReport | null>(() => {
    if (!business) return null;
    try {
      return buildFinancialReport({ businessName: business.businessName, currency: business.currency, timezone: business.timezone, period: { preset, selectedMonth, customFrom, customTo }, bookings: bookingData.bookings, customers: customerData.customers, services: serviceData.services, payments: paymentData.payments, expenses: expenseData.expenses, expenseCategories: categoryData.categories, invoices: invoiceRepository.getAll() });
    } catch {
      return null;
    }
  }, [business, preset, selectedMonth, customFrom, customTo, bookingData.bookings, customerData.customers, serviceData.services, paymentData.payments, expenseData.expenses, categoryData.categories]);

  const paymentMethods = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of report?.moneyReceived ?? []) totals.set(payment.method, (totals.get(payment.method) ?? 0) + payment.amount);
    return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [report]);
  const expenseCategories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of report?.expenses ?? []) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [report]);
  const bookingStatuses = useMemo(() => {
    const totals = new Map<string, number>();
    for (const booking of report?.bookings ?? []) totals.set(booking.status, (totals.get(booking.status) ?? 0) + 1);
    return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [report]);
  const todayKey = business ? instantParts(new Date().toISOString(), business.timezone).date : "";
  const insights = useMemo(() => report && todayKey ? buildFinancialReportInsights({
    report,
    bookings: bookingData.bookings,
    payments: paymentData.payments,
    expenses: expenseData.expenses,
    todayKey,
  }) : null, [report, todayKey, bookingData.bookings, paymentData.payments, expenseData.expenses]);

  async function exportExcel() {
    if (!report) return;
    setExporting("excel");
    try { await downloadFinancialReport(report); notify.success("Excel report downloaded."); }
    catch { notify.error("Could not create the Excel report."); }
    finally { setExporting(null); }
  }

  async function exportSheets() {
    if (!report) return;
    if (!cloudMode) return notify.info("Sign in and enable Qai Cloud before exporting to Google Sheets.");
    setExporting("sheets");
    try { const url = await exportFinancialReportToGoogleSheets(report); setSheetsExport({ url, periodLabel: report.period.label }); notify.success("Google Sheets report created."); }
    catch (error) { notify.error(error instanceof Error ? error.message : "Could not create the Google Sheets report."); }
    finally { setExporting(null); }
  }

  const dataSources = [bookingData, customerData, serviceData, paymentData, expenseData, categoryData];
  if (dataSources.some((source) => source.isLoading) || !business) return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  if (dataSources.some((source) => source.loadError)) return <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => dataSources.forEach((source) => source.retry())} /></div></main>;

  return <main className="min-h-screen overflow-x-hidden"><div className="page-shell space-y-5">
    <header><h1 className="page-title">Financial reports</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">A concise view of business performance. Detailed records remain available in your exports.</p></header>
    <section className="surface-card grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end"><div className="grid gap-4 sm:grid-cols-3"><div><Label className="mb-2 block">Report period</Label><ReportPeriodSelector value={{ preset, selectedMonth, customFrom, customTo }} currentMonth={instantParts(new Date().toISOString(), business.timezone).date.slice(0, 7)} resolvedLabel={report?.period.label} includeCustom className="w-full" onChange={(next) => { setPreset(next.preset); setSelectedMonth(next.selectedMonth ?? ""); }} /></div>{preset === "custom" && <><div><Label className="mb-2 block">From</Label><Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></div><div><Label className="mb-2 block">To</Label><Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></div></>}</div><div className={`grid gap-2 ${cloudMode ? "sm:grid-cols-2" : ""}`}><Button variant="outline" disabled={!report || exporting !== null} onClick={exportExcel}><Download className="size-4" />{exporting === "excel" ? "Creating…" : "Excel"}</Button>{cloudMode && <Button disabled={!report || exporting !== null} onClick={exportSheets}><FileSpreadsheet className="size-4" />{exporting === "sheets" ? "Creating…" : "Google Sheets"}</Button>}</div>{sheetsExport && sheetsExport.periodLabel === report?.period.label && <a className="font-semibold text-primary hover:underline lg:col-span-2" href={sheetsExport.url} target="_blank" rel="noreferrer">Open in Google Sheets <ExternalLink className="ml-1 inline size-4" /></a>}</section>
    {!report ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Choose a valid custom date range.</p> : <>
      <section aria-label="Report summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4"><SummaryCard label="Income" value={formatMoney(report.summary.moneyReceived, report.currency)} detail={`${report.moneyReceived.length} recorded payments in ${report.period.label}`} tone="positive" /><SummaryCard label="Expenses" value={formatMoney(report.summary.expenses, report.currency)} detail={`${report.expenses.length} recorded expenses in ${report.period.label}`} /><SummaryCard label="Profit" value={formatMoney(report.summary.realizedProfit, report.currency)} detail="Income minus all expenses in the selected period" tone={report.summary.realizedProfit >= 0 ? "positive" : "warning"} /><SummaryCard label="Unpaid amount" value={formatMoney(report.summary.outstanding, report.currency)} detail="Active booking balances in the selected period" tone="warning" /></section>
      {insights && <section aria-labelledby="report-insights-heading"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Business insights</p><h2 id="report-insights-heading" className="mt-1 text-lg font-bold">What to act on</h2></div><p className="text-xs text-muted-foreground">Period cards use {report.period.label}; upcoming payments use a separate forward window.</p></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><SummaryCard label="Upcoming payments" value={formatMoney(insights.upcomingPayments.amount, report.currency)} detail={`Next 7 days through ${insights.upcomingPayments.throughDate} · ${insights.upcomingPayments.bookings} bookings`} tone="warning" /><SummaryCard label="Average booking value" value={formatMoney(insights.averageBookingValue, report.currency)} detail={`${insights.financiallyActiveBookings} active bookings in ${report.period.label}`} /><SummaryCard label="Top service" value={insights.topService?.name ?? "—"} detail={insights.topService ? `${formatMoney(insights.topService.amount, report.currency)} received in ${report.period.label}` : `No received payments in ${report.period.label}`} /><SummaryCard label="Busiest schedule day" value={insights.busiestScheduleDay?.label ?? "—"} detail={insights.busiestScheduleDay ? `${insights.busiestScheduleDay.schedules} schedules in ${report.period.label}` : `No schedules in ${report.period.label}`} /></div></section>}
      <div className="grid gap-5 lg:grid-cols-3"><Breakdown title="Money received" subtitle="Recorded payments by method" rows={paymentMethods} currency={report.currency} /><Breakdown title="Expenses" subtitle="Expenses by category" rows={expenseCategories} currency={report.currency} /><Breakdown title="Booking volume" subtitle="Bookings by current status" rows={bookingStatuses} currency={report.currency} money={false} /></div>
      <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">Exports include transaction-level sheets for Income, Expenses, Job Profit, Outstanding, Bookings, Schedule, and Invoices. Multi-session bookings remain one financial row; each schedule is exported separately.</p>
    </>}
  </div></main>;
}
