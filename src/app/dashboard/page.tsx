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
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";
import type { ReportPeriodInput } from "@/features/reports/financialReport";
import CustomizeDashboardDialog from "@/features/dashboard/components/CustomizeDashboardDialog";
import { loadDashboardPreferences, saveDashboardPreferences, type DashboardPreference, type DashboardSectionId } from "@/features/dashboard/customization";
import { validationClient, type PublicRequest } from "@/features/qai-page/validation";
import { Button } from "@/components/ui/button";
import NeedsAttention from "@/features/dashboard/components/NeedsAttention";

const CARD_CLASS =
  "surface-card min-w-0 p-5 sm:p-6";

export default function DashboardPage() {
  const [period, setPeriod] = useState<ReportPeriodInput>({ preset: "this-month" });
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [preferences, setPreferences] = useState<DashboardPreference[]>(loadDashboardPreferences);
  const [newRequests, setNewRequests] = useState<PublicRequest[]>([]);
  const dashboard = useDashboard({ period });
  const periodQuery = new URLSearchParams({ preset: period.preset, ...(period.selectedMonth ? { month: period.selectedMonth } : {}) }).toString();

  useEffect(() => {
    let active = true;
    async function loadRequests() {
      try {
        const store = await validationClient.owner();
        if (active) setNewRequests(store.requests.filter((item) => item.status === "Pending" || (item.type === "Instant booking" && !item.bookingId)).sort((a, b) => b.submittedAt - a.submittedAt));
      } catch { if (active) setNewRequests([]); }
    }
    void loadRequests();
    const timer = window.setInterval(() => { void loadRequests(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  function updatePreferences(next: DashboardPreference[]) {
    setPreferences(saveDashboardPreferences(next));
  }

  if (dashboard.isLoading) return <main className="min-h-screen"><PageSkeleton variant="dashboard" /></main>;
  if (dashboard.loadError) return <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={dashboard.retry} /></div></main>;

  return (
    <main className="dashboard-theme min-h-screen overflow-x-hidden bg-[var(--dashboard-bg)]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <DashboardHeader period={period} currentMonth={dashboard.currentMonth} resolvedLabel={dashboard.financialReport.period.label} onPeriodChange={setPeriod} onCustomize={() => setCustomizeOpen(true)} />

        <NeedsAttention
          overdueCount={dashboard.latePaymentsCount}
          dueSoonCount={dashboard.paymentsDueSoonCount}
          requestCount={newRequests.length}
          todayCount={dashboard.todaysSchedule.length}
        />

        {preferences.some((item) => item.id === "setup" && item.visible) && dashboard.showSetupGuide && <GettingStartedGuide {...dashboard.setupGuideProgress} />}

        <div className="min-w-0 columns-1 lg:columns-2 lg:[column-gap:1.5rem]">
          {preferences.filter((item) => item.visible && item.id !== "setup").map((item) => (
            <DashboardSection key={item.id} id={item.id}>
              {item.id === "income" && <FinancialAnalyticsCard title="Income" total={dashboard.financialReport.summary.moneyReceived} period={dashboard.financialReport.period.label} categories={dashboard.incomeByCategory.map((entry) => ({ id: entry.categoryId, name: entry.categoryName, amount: entry.revenue, color: entry.categoryColor }))} href={`/reports?${periodQuery}#income`} emptyMessage="No income recorded in this period." tone="income" />}
              {item.id === "expenses" && <FinancialAnalyticsCard title="Expenses" total={dashboard.financialReport.summary.expenses} period={dashboard.financialReport.period.label} categories={dashboard.expenseByCategory.map((entry) => ({ id: entry.categoryId, name: entry.category, amount: entry.amount, color: entry.categoryColor }))} href={`/reports?${periodQuery}#expenses`} emptyMessage="No expenses recorded in this period." tone="expenses" />}
              {item.id === "profit" && <KPICard metric={dashboard.metrics.find((entry) => entry.label === "Profit")!} periodQuery={periodQuery} />}
              {item.id === "unpaid" && <KPICard metric={dashboard.metrics.find((entry) => entry.label === "Unpaid amount")!} periodQuery={periodQuery} />}
              {item.id === "upcoming" && <div className={CARD_CLASS}><UpcomingJobs items={dashboard.upcomingJobs} timezone={dashboard.timezone} /></div>}
              {item.id === "due-soon" && <div className={CARD_CLASS}><PaymentDueList title="Payments due soon" description="The next unpaid amounts coming due." emptyMessage="No payments due soon." items={dashboard.paymentsDueSoon} todayKey={dashboard.todayKey} businessName={dashboard.businessName} timezone={dashboard.timezone} /></div>}
              {item.id === "overdue" && <div className={CARD_CLASS}><PaymentDueList title="Overdue payments" description="Unpaid amounts past their due date." emptyMessage="No overdue payments." items={dashboard.latePayments} late todayKey={dashboard.todayKey} businessName={dashboard.businessName} timezone={dashboard.timezone} /></div>}
              {item.id === "requests" && <NewRequestsCard requests={newRequests} />}
            </DashboardSection>
          ))}
        </div>

        <div className={CARD_CLASS}><TodaySchedule items={dashboard.todaysSchedule} timezone={dashboard.timezone} /></div>
        <div className={CARD_CLASS}><RevenueChart data={dashboard.revenueSeries} /></div>

      </div>
      <CustomizeDashboardDialog open={customizeOpen} value={preferences} onChange={updatePreferences} onClose={() => setCustomizeOpen(false)} />
    </main>
  );
}

function DashboardSection({ id, fullWidth, children }: { id: DashboardSectionId; fullWidth?: boolean; children: React.ReactNode }) {
  if (!children || (id === "setup" && Array.isArray(children) && children.every((item) => !item))) return null;
  return <div className={`mb-5 min-w-0 break-inside-avoid lg:mb-6 ${fullWidth ? "lg:col-span-2" : ""}`}>{children}</div>;
}

function NewRequestsCard({ requests }: { requests: PublicRequest[] }) {
  return <section className="surface-card min-w-0 p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-[var(--dashboard-text)]">New requests</h2><p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">Pending work from your Qai Page.</p></div><span className="rounded-full bg-[var(--dashboard-income-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--dashboard-income-text)]">{requests.length}</span></div>{requests.length === 0 ? <div className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-6 text-center text-sm text-[var(--dashboard-muted-text)]">No new requests.</div> : <div className="mt-5 space-y-2">{requests.slice(0, 3).map((request) => <div key={request.id} className="rounded-xl border border-[var(--dashboard-border)] p-3"><p className="truncate font-semibold">{request.clientName}</p><p className="mt-1 truncate text-sm text-[var(--dashboard-muted-text)]">{request.serviceName} · {request.type}</p></div>)}</div>}<Button className="mt-4" variant="outline" size="sm" render={<Link href="/qai-page" />}>View requests</Button></section>;
}
