"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";
import GettingStartedGuide from "@/features/dashboard/components/GettingStartedGuide";
import KPICard from "@/features/dashboard/components/KPICard";
import TodaySchedule from "@/features/dashboard/components/TodaySchedule";
import UpcomingJobs from "@/features/dashboard/components/UpcomingJobs";
import RevenueChart from "@/features/dashboard/components/RevenueChart";
import FinancialAnalyticsCard from "@/features/dashboard/components/FinancialAnalyticsCard";
import PaymentDueList from "@/features/dashboard/components/PaymentDueList";
import { useDashboard, type KPI } from "@/features/dashboard/hooks/useDashboard";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";
import type { ReportPeriodInput } from "@/features/reports/financialReport";
import CustomizeDashboardDialog from "@/features/dashboard/components/CustomizeDashboardDialog";
import { loadDashboardPreferences, saveDashboardPreferences, type DashboardPreference, type DashboardSectionId } from "@/features/dashboard/customization";
import type { PublicRequest } from "@/features/qai-page/validation";
import { Button } from "@/components/ui/button";
import NeedsAttention from "@/features/dashboard/components/NeedsAttention";
import { BookOpenCheck, FileText, ReceiptText, UserPlus } from "lucide-react";
import useOperationalAttention from "@/features/dashboard/hooks/useOperationalAttention";
import ReportPeriodSelector from "@/features/reports/ReportPeriodSelector";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

const CARD_CLASS =
  "surface-card min-w-0 p-5 sm:p-6";

const METRIC_SECTION_IDS: Record<KPI["label"], DashboardSectionId> = {
  Income: "income",
  Expenses: "expenses",
  Profit: "profit",
  "Unpaid amount": "unpaid",
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<ReportPeriodInput>({ preset: "this-month" });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [preferences, setPreferences] = useState<DashboardPreference[]>(loadDashboardPreferences);
  const dashboard = useDashboard({ period });
  const attention = useOperationalAttention();
  const newRequests = attention.pendingRequests;
  const periodQuery = new URLSearchParams({ preset: period.preset, ...(period.selectedMonth ? { month: period.selectedMonth } : {}) }).toString();

  useEffect(() => {
    const openCustomize = () => setCustomizeOpen(true);
    window.addEventListener("qai:customize-dashboard", openCustomize);
    return () => window.removeEventListener("qai:customize-dashboard", openCustomize);
  }, []);

  function updatePreferences(next: DashboardPreference[]) {
    setPreferences(saveDashboardPreferences(next));
  }

  const isVisible = (id: DashboardSectionId) => preferences.some((item) => item.id === id && item.visible);

  if (dashboard.isLoading) return <main className="min-h-screen"><PageSkeleton variant="dashboard" /></main>;
  if (dashboard.loadError) return <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={dashboard.retry} /></div></main>;

  return (
    <main className="dashboard-theme min-h-screen overflow-x-hidden bg-[var(--dashboard-bg)]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:space-y-8 lg:px-8 lg:py-10">
        <DashboardHeader onCustomize={() => setCustomizeOpen(true)} />

        <DashboardQuickActions />

        <section aria-labelledby="dashboard-day-heading" className="space-y-0 lg:space-y-3">
          <div className="hidden items-end justify-between gap-3 lg:flex">
            <div>
              <p className="section-kicker">Operate today</p>
              <h2 id="dashboard-day-heading" className="mt-1 text-xl font-bold tracking-tight">Your day at a glance</h2>
            </div>
            <Link href="/calendar" className="text-sm font-semibold text-primary hover:underline">Open calendar</Link>
          </div>
          <div className="grid min-w-0 gap-0 lg:gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(21rem,.65fr)]">
            <div className="-mx-4 min-w-0 border-t border-[var(--dashboard-border)] bg-card px-4 py-5 lg:mx-0 lg:rounded-xl lg:border lg:p-6 lg:shadow-[var(--shadow-surface)]"><TodaySchedule items={dashboard.todaysSchedule} timezone={dashboard.timezone} /></div>
            <NeedsAttention
              overdueCount={attention.overdueCount}
              overdueAmount={attention.overdueAmount}
              requestCount={attention.requestCount}
            />
          </div>
        </section>

        {(isVisible("income") || isVisible("expenses") || isVisible("profit") || isVisible("unpaid")) && <section aria-labelledby="money-snapshot-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><p className="section-kicker lg:hidden">Money</p><p className="section-kicker hidden lg:block">Money snapshot</p><h2 id="money-snapshot-heading" className="mt-1 hidden text-xl font-bold tracking-tight lg:block">Know what moved</h2></div>
            <ReportPeriodSelector value={period} currentMonth={dashboard.currentMonth} resolvedLabel={dashboard.financialReport.period.label} onChange={setPeriod} className="h-10 w-36 border-0 bg-transparent px-2 shadow-none" />
          </div>
          <MobileMoneySnapshot metrics={dashboard.metrics.filter((metric) => !["Income", "Expenses"].includes(metric.label) && isVisible(METRIC_SECTION_IDS[metric.label]))} periodQuery={periodQuery} />
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 lg:hidden">
            {isVisible("income") && <FinancialAnalyticsCard title="Income by category" total={dashboard.financialReport.summary.moneyReceived} period={dashboard.financialReport.period.label} categories={dashboard.incomeByCategory.map((entry) => ({ id: entry.categoryId, name: entry.categoryName, amount: entry.revenue, color: entry.categoryColor }))} href={`/reports?${periodQuery}#income`} emptyMessage="No income recorded in this period." tone="income" />}
            {isVisible("expenses") && <FinancialAnalyticsCard title="Expenses by category" total={dashboard.financialReport.summary.expenses} period={dashboard.financialReport.period.label} categories={dashboard.expenseByCategory.map((entry) => ({ id: entry.categoryId, name: entry.category, amount: entry.amount, color: entry.categoryColor }))} href={`/reports?${periodQuery}#expenses`} emptyMessage="No expenses recorded in this period." tone="expenses" />}
          </div>
          <div className="hidden min-w-0 gap-5 lg:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(17rem,.62fr)]">
            {isVisible("income") && <FinancialAnalyticsCard title="Income by category" total={dashboard.financialReport.summary.moneyReceived} period={dashboard.financialReport.period.label} categories={dashboard.incomeByCategory.map((entry) => ({ id: entry.categoryId, name: entry.categoryName, amount: entry.revenue, color: entry.categoryColor }))} href={`/reports?${periodQuery}#income`} emptyMessage="No income recorded in this period." tone="income" />}
            {isVisible("expenses") && <FinancialAnalyticsCard title="Expenses by category" total={dashboard.financialReport.summary.expenses} period={dashboard.financialReport.period.label} categories={dashboard.expenseByCategory.map((entry) => ({ id: entry.categoryId, name: entry.category, amount: entry.amount, color: entry.categoryColor }))} href={`/reports?${periodQuery}#expenses`} emptyMessage="No expenses recorded in this period." tone="expenses" />}
            <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-1">
              {isVisible("profit") && <KPICard metric={dashboard.metrics.find((entry) => entry.label === "Profit")!} periodQuery={periodQuery} />}
              {isVisible("unpaid") && <KPICard metric={dashboard.metrics.find((entry) => entry.label === "Unpaid amount")!} periodQuery={periodQuery} />}
            </div>
          </div>
        </section>}

        {isVisible("setup") && dashboard.showSetupGuide && <GettingStartedGuide {...dashboard.setupGuideProgress} />}

        {(isVisible("upcoming") || isVisible("requests") || isVisible("due-soon") || isVisible("overdue")) && <section aria-labelledby="next-actions-heading">
          <div className="mb-3">
            <p className="section-kicker">Next actions</p>
            <h2 id="next-actions-heading" className="mt-1 text-xl font-bold tracking-tight">Keep work moving</h2>
          </div>
          <div className="grid min-w-0 gap-5 lg:grid-cols-2">
            {isVisible("upcoming") && <div className={CARD_CLASS}><UpcomingJobs items={dashboard.upcomingJobs} timezone={dashboard.timezone} /></div>}
            {isVisible("requests") && <NewRequestsCard requests={newRequests} />}
            {isVisible("due-soon") && <div className={CARD_CLASS}><PaymentDueList title="Payments due soon" description="The next unpaid amounts coming due." emptyMessage="No payments due soon." items={dashboard.paymentsDueSoon} todayKey={dashboard.todayKey} businessName={dashboard.businessName} timezone={dashboard.timezone} /></div>}
            {isVisible("overdue") && <div className={CARD_CLASS}><PaymentDueList title="Overdue payments" description="Unpaid amounts past their due date." emptyMessage="No overdue payments." items={dashboard.latePayments} late todayKey={dashboard.todayKey} businessName={dashboard.businessName} timezone={dashboard.timezone} /></div>}
          </div>
        </section>}

        {isVisible("yearly") && <div className={CARD_CLASS}><RevenueChart data={dashboard.revenueSeries} /></div>}

      </div>
      <CustomizeDashboardDialog open={customizeOpen} value={preferences} onChange={updatePreferences} onClose={() => setCustomizeOpen(false)} />
    </main>
  );
}

function DashboardQuickActions() {
  const actions = [
    { href: "/bookings?new=1", label: "New booking", detail: "Plan work", Icon: BookOpenCheck },
    { href: "/customers?new=1", label: "Add client", detail: "Save a contact", Icon: UserPlus },
    { href: "/expenses?new=1", label: "Add expense", detail: "Record a cost", Icon: ReceiptText },
    { href: "/invoices?new=1", label: "New invoice", detail: "Bill a client", Icon: FileText },
  ];
  return <section aria-label="Quick actions" className="hidden grid-cols-4 gap-2 lg:grid">{actions.map(({ href, label, detail, Icon }) => <Link key={href} href={href} className="group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm transition hover:border-primary/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary"><Icon className="size-4.5" aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{label}</span><span className="block truncate text-xs text-muted-foreground">{detail}</span></span></Link>)}</section>;
}

function MobileMoneySnapshot({ metrics, periodQuery }: { metrics: KPI[]; periodQuery: string }) {
  if (metrics.length === 0) return null;
  const hrefFor = (metric: KPI) => metric.label === "Unpaid amount" ? "/bookings?payment=outstanding" : `/reports?${periodQuery}#${metric.label === "Income" ? "income" : metric.label.toLowerCase()}`;
  return <div className="-mx-4 grid grid-cols-2 border-y border-border bg-card lg:hidden">
    {metrics.map((metric, index) => <Link key={metric.label} href={hrefFor(metric)} className={`min-w-0 px-4 py-4 ${index % 2 === 0 ? "border-r border-border" : ""} ${index >= 2 ? "border-t border-border" : ""}`}>
      <span className="block text-xs font-medium text-muted-foreground">{metric.label === "Income" ? "Received" : metric.label}</span>
      <span className="mt-1 block truncate text-lg font-bold tabular-nums text-foreground">{formatRupiah(metric.value)}</span>
    </Link>)}
  </div>;
}

function NewRequestsCard({ requests }: { requests: PublicRequest[] }) {
  return <section className="surface-card min-w-0 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-[var(--dashboard-text)]">New requests</h2><p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Pending work from your Qai Page.</p></div><span className="rounded-full bg-[var(--dashboard-income-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--dashboard-income-text)]">{requests.length}</span></div>{requests.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">No new requests.</div> : <div className="mt-5 space-y-2">{requests.slice(0, 3).map((request) => <div key={request.id} className="rounded-xl border border-[var(--dashboard-border)] p-3"><p className="truncate font-semibold">{request.clientName}</p><p className="mt-1 truncate text-sm text-[var(--dashboard-muted-text)]">{request.serviceName} · {request.type}</p></div>)}</div>}<Button className="mt-4" variant="outline" size="sm" render={<Link href="/qai-page" />}>View requests</Button></section>;
}
