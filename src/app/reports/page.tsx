"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DataErrorState from "@/components/system/DataErrorState";
import PageSkeleton from "@/components/system/PageSkeleton";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";
import {
  buildFinancialReport,
  type FinancialReport,
  type ReportPeriodPreset,
} from "@/features/reports/financialReport";
import ReportPeriodSelector from "@/features/reports/ReportPeriodSelector";
import { instantParts } from "@/features/booking/utils/bookingSessions";
import { downloadFinancialReport } from "@/features/reports/excelExport";
import { exportFinancialReportToGoogleSheets } from "@/features/reports/googleSheetsExport";
import { formatSessionTime } from "@/features/booking/utils/bookingSessions";
import { getActiveBusinessContext, type ActiveBusinessContext } from "@/lib/supabase/cloudRepositories";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { notify } from "@/lib/notifications";

function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function ReportSection({ title, subtitle, children, id }: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <details id={id} open className="surface-card group scroll-mt-6 p-4 sm:p-6">
      <summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <span className="text-sm text-muted-foreground group-open:hidden">Show</span>
        </div>
      </summary>
      <div className="mt-5">{children}</div>
    </details>
  );
}

function EmptyRows() {
  return <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">No records in this period.</p>;
}

function ReportCards({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 lg:grid-cols-2">{children}</div>;
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
  const business = useMemo<ActiveBusinessContext | null>(() => cloudMode ? cloudBusiness : ({
    businessId: "local",
    businessName: "Qai Business",
    currency: "IDR",
    timezone: bookingData.timezone,
  }), [cloudMode, cloudBusiness, bookingData.timezone]);

  useEffect(() => {
    let active = true;
    if (!cloudMode) return () => { active = false; };
    void getActiveBusinessContext()
      .then((context) => { if (active) setCloudBusiness(context); })
      .catch(() => { if (active) setCloudBusiness(null); });
    return () => { active = false; };
  }, [cloudMode, bookingData.timezone]);

  const report = useMemo<FinancialReport | null>(() => {
    if (!business) return null;
    try {
      return buildFinancialReport({
        businessName: business.businessName,
        currency: business.currency,
        timezone: business.timezone,
        period: { preset, selectedMonth, customFrom, customTo },
        bookings: bookingData.bookings,
        customers: customerData.customers,
        services: serviceData.services,
        payments: paymentData.payments,
        expenses: expenseData.expenses,
        expenseCategories: categoryData.categories,
      });
    } catch {
      return null;
    }
  }, [business, preset, selectedMonth, customFrom, customTo, bookingData.bookings, customerData.customers, serviceData.services, paymentData.payments, expenseData.expenses, categoryData.categories]);

  async function exportExcel() {
    if (!report) return;
    setExporting("excel");
    try {
      await downloadFinancialReport(report);
      notify.success("Excel report downloaded.");
    } catch {
      notify.error("Could not create the Excel report.");
    } finally {
      setExporting(null);
    }
  }

  async function exportSheets() {
    if (!report) return;
    if (!cloudMode) {
      notify.info("Sign in and enable Qai Cloud before exporting to Google Sheets.");
      return;
    }
    setExporting("sheets");
    try {
      const url = await exportFinancialReportToGoogleSheets(report);
      setSheetsExport({ url, periodLabel: report.period.label });
      notify.success("Google Sheets report created.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Could not create the Google Sheets report.");
    } finally {
      setExporting(null);
    }
  }

  const dataSources = [bookingData, customerData, serviceData, paymentData, expenseData, categoryData];
  if (dataSources.some((source) => source.isLoading) || !business) {
    return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  }
  if (dataSources.some((source) => source.loadError)) {
    return <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => dataSources.forEach((source) => source.retry())} /></div></main>;
  }

  return (
    <main className="min-h-screen overflow-x-hidden">
      <div className="page-shell space-y-5">
        <header>
          <p className="text-sm font-semibold text-[var(--brand)]">Financial Reports</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Your business, exportable.</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Booking financials stay booking-level; individual schedules are listed separately.
          </p>
        </header>

        <section className="surface-card grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="mb-2 block">Report Period</Label>
              <ReportPeriodSelector
                value={{ preset, selectedMonth, customFrom, customTo }}
                currentMonth={instantParts(new Date().toISOString(), business.timezone).date.slice(0, 7)}
                resolvedLabel={report?.period.label}
                includeCustom
                className="w-full"
                onChange={(next) => { setPreset(next.preset); setSelectedMonth(next.selectedMonth ?? ""); }}
              />
            </div>
            {preset === "custom" && (
              <>
                <div><Label className="mb-2 block">From</Label><Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></div>
                <div><Label className="mb-2 block">To</Label><Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></div>
              </>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" disabled={!report || exporting !== null} onClick={exportExcel}>
              <Download className="size-4" aria-hidden="true" /> {exporting === "excel" ? "Creating…" : "Export to Excel"}
            </Button>
            <Button type="button" disabled={!report || exporting !== null} onClick={exportSheets}>
              <FileSpreadsheet className="size-4" aria-hidden="true" /> {exporting === "sheets" ? "Creating…" : "Export to Google Sheets"}
            </Button>
          </div>
          {sheetsExport && sheetsExport.periodLabel === report?.period.label && (
            <a className="font-semibold text-[var(--brand)] hover:underline lg:col-span-2" href={sheetsExport.url} target="_blank" rel="noreferrer">
              Open in Google Sheets <ExternalLink className="ml-1 inline size-4" aria-hidden="true" />
            </a>
          )}
        </section>

        {!report ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Choose a valid custom date range.</p>
        ) : (
          <>
            <section aria-label="Report summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Income", report.summary.moneyReceived, true],
                ["Expenses", report.summary.expenses, true],
                ["Realized Profit", report.summary.realizedProfit, true],
                ["Outstanding", report.summary.outstanding, true],
                ["Expected Booking Value", report.summary.expectedBookingValue, true],
                ["Est. Job Profit", report.summary.estimatedJobProfit, true],
                ["Bookings", report.summary.bookings, false],
                ["Scheduled Sessions", report.summary.scheduledSessions, false],
              ].map(([label, value, money]) => (
                <article key={String(label)} className="surface-card min-w-0 p-4">
                  <p className="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
                  <p className="mt-2 break-words text-lg font-bold text-foreground sm:text-xl">
                    {money ? formatMoney(Number(value), report.currency) : Number(value).toLocaleString("en-US")}
                  </p>
                </article>
              ))}
            </section>

            <ReportSection id="income" title="Income" subtitle={`${report.moneyReceived.length} recorded payment transactions`}>
              {report.moneyReceived.length === 0 ? <EmptyRows /> : <ReportCards>{report.moneyReceived.map((row) => (
                <article key={row.paymentId} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.customer}</p><p className="text-sm text-muted-foreground">{row.service} · {row.date}</p></div><p className="shrink-0 font-bold">{formatMoney(row.amount, report.currency)}</p></div>
                  <p className="mt-2 text-sm text-muted-foreground">{row.method} · Booking {row.bookingStatus}</p>
                </article>
              ))}</ReportCards>}
            </ReportSection>

            <ReportSection id="expenses" title="Expenses" subtitle={`${report.expenses.length} recorded expenses`}>
              {report.expenses.length === 0 ? <EmptyRows /> : <ReportCards>{report.expenses.map((row) => (
                <article key={row.expenseId} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{row.category}</p><p className="text-sm text-muted-foreground">{row.type} · {row.date}</p></div><p className="shrink-0 font-bold">{formatMoney(row.amount, report.currency)}</p></div>
                  {(row.customer || row.vendor) && <p className="mt-2 text-sm text-muted-foreground">{row.customer || row.vendor}{row.service ? ` · ${row.service}` : ""}</p>}
                </article>
              ))}</ReportCards>}
            </ReportSection>

            <ReportSection title="Job Profit" subtitle="Booking value minus direct booking expenses; general expenses are excluded">
              {report.jobProfit.length === 0 ? <EmptyRows /> : <ReportCards>{report.jobProfit.map((row) => (
                <article key={row.bookingId} className="rounded-xl border border-border p-4">
                  <p className="font-semibold">{row.customer} · {row.service}</p><p className="mt-1 text-sm text-muted-foreground">{row.firstSessionDate} · {row.sessionCount} session{row.sessionCount === 1 ? "" : "s"}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><span>Direct expenses<br /><strong>{formatMoney(row.directExpenses, report.currency)}</strong></span><span>Est. profit<br /><strong>{formatMoney(row.estimatedJobProfit ?? 0, report.currency)}</strong></span></div>
                </article>
              ))}</ReportCards>}
            </ReportSection>

            <ReportSection title="Outstanding Payments" subtitle="Only financially active Scheduled and Completed bookings">
              {report.outstanding.length === 0 ? <EmptyRows /> : <ReportCards>{report.outstanding.map((row) => (
                <article key={row.bookingId} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{row.customer}</p><p className="text-sm text-muted-foreground">{row.service} · due {row.paymentDueDate}</p></div><p className="font-bold text-amber-700">{formatMoney(row.outstanding ?? 0, report.currency)}</p></div></article>
              ))}</ReportCards>}
            </ReportSection>

            <ReportSection title="Bookings" subtitle={`${report.bookings.length} financial bookings; multi-session bookings occur once`}>
              {report.bookings.length === 0 ? <EmptyRows /> : <ReportCards>{report.bookings.map((row) => (
                <article key={row.bookingId} className="rounded-xl border border-border p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{row.customer} · {row.service}</p><p className="text-sm text-muted-foreground">{row.firstSessionDate} · {row.status} · {row.sessionCount} session{row.sessionCount === 1 ? "" : "s"}</p></div><p className="font-bold">{formatMoney(row.bookingValue, report.currency)}</p></div></article>
              ))}</ReportCards>}
            </ReportSection>

            <ReportSection title="Schedule / Booking Sessions" subtitle={`${report.schedule.length} individual scheduled sessions`}>
              {report.schedule.length === 0 ? <EmptyRows /> : <ReportCards>{report.schedule.map((row) => (
                <article key={row.sessionId} className="rounded-xl border border-border p-4"><p className="font-semibold">Session {row.sequence}{row.label ? ` · ${row.label}` : ""}</p><p className="mt-1 text-sm text-muted-foreground">{row.customer} · {row.service}</p><p className="mt-2 text-sm">{row.date} · {formatSessionTime({ id: row.sessionId, bookingId: row.bookingId, sequence: row.sequence, label: row.label, startAt: row.startAt, endAt: row.endAt, location: row.location, notes: row.notes, createdAt: 0, updatedAt: 0 }, report.timezone)}</p>{row.location && <p className="mt-1 text-sm text-muted-foreground">{row.location}</p>}</article>
              ))}</ReportCards>}
            </ReportSection>
          </>
        )}
      </div>
    </main>
  );
}
