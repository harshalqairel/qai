"use client";

import { useState } from "react";
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";
import GettingStartedGuide from "@/features/dashboard/components/GettingStartedGuide";
import KPIGrid from "@/features/dashboard/components/KPIGrid";
import TodaySchedule from "@/features/dashboard/components/TodaySchedule";
import UpcomingJobs from "@/features/dashboard/components/UpcomingJobs";
import RevenueChart from "@/features/dashboard/components/RevenueChart";
import FinancialAnalyticsCard from "@/features/dashboard/components/FinancialAnalyticsCard";
import PaymentDueList from "@/features/dashboard/components/PaymentDueList";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";
import type { ReportPeriodInput } from "@/features/reports/financialReport";

const CARD_CLASS =
  "surface-card min-w-0 p-5 sm:p-6";

export default function DashboardPage() {
  const [period, setPeriod] = useState<ReportPeriodInput>({ preset: "this-month" });
  const dashboard = useDashboard({ period });
  const periodQuery = new URLSearchParams({ preset: period.preset, ...(period.selectedMonth ? { month: period.selectedMonth } : {}) }).toString();

  if (dashboard.isLoading) return <main className="min-h-screen"><PageSkeleton variant="dashboard" /></main>;
  if (dashboard.loadError) return <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={dashboard.retry} /></div></main>;

  return (
    <main className="dashboard-theme min-h-screen overflow-x-hidden bg-[var(--dashboard-bg)]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <DashboardHeader period={period} currentMonth={dashboard.currentMonth} resolvedLabel={dashboard.financialReport.period.label} onPeriodChange={setPeriod} />

        {dashboard.showSetupGuide && <GettingStartedGuide {...dashboard.setupGuideProgress} />}

        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
          <FinancialAnalyticsCard title="Income" total={dashboard.financialReport.summary.moneyReceived} period={dashboard.financialReport.period.label} categories={dashboard.incomeByCategory.map((item) => ({ id: item.categoryId, name: item.categoryName, amount: item.revenue, color: item.categoryColor }))} href={`/reports?${periodQuery}#income`} emptyMessage="No income recorded in this period." tone="income" />
          <FinancialAnalyticsCard title="Expenses" total={dashboard.financialReport.summary.expenses} period={dashboard.financialReport.period.label} categories={dashboard.expenseByCategory.map((item) => ({ id: item.category, name: item.category, amount: item.amount }))} href={`/reports?${periodQuery}#expenses`} emptyMessage="No expenses recorded in this period." tone="expenses" />
        </div>

        <KPIGrid metrics={dashboard.metrics.filter((metric) => metric.label === "Unpaid Amount" || metric.label === "Profit")} periodQuery={periodQuery} />

        <div className={CARD_CLASS}>
          <RevenueChart data={dashboard.revenueSeries} />
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={CARD_CLASS}>
            <TodaySchedule items={dashboard.todaysSchedule} timezone={dashboard.timezone} />
          </div>
          <div className={CARD_CLASS}>
            <PaymentDueList
              title="Payments Due Soon"
              description="The next unpaid amounts coming due."
              emptyMessage="No payments due soon."
              items={dashboard.paymentsDueSoon}
              todayKey={dashboard.todayKey}
              businessName={dashboard.businessName}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={CARD_CLASS}>
            <UpcomingJobs items={dashboard.upcomingJobs} timezone={dashboard.timezone} />
          </div>
          <div className={CARD_CLASS}>
            <PaymentDueList
              title="Late Payments"
              description="Unpaid amounts past their due date."
              emptyMessage="No late payments."
              items={dashboard.latePayments}
              late
              todayKey={dashboard.todayKey}
              businessName={dashboard.businessName}
            />
          </div>
        </div>

      </div>
    </main>
  );
}
