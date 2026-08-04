"use client";

import { useState } from "react";
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";
import KPIGrid from "@/features/dashboard/components/KPIGrid";
import TodaySchedule from "@/features/dashboard/components/TodaySchedule";
import UpcomingJobs from "@/features/dashboard/components/UpcomingJobs";
import RevenueChart from "@/features/dashboard/components/RevenueChart";
import IncomeByCategory from "@/features/dashboard/components/IncomeByCategory";
import ExpenseByCategory from "@/features/dashboard/components/ExpenseByCategory";
import PaymentDueList from "@/features/dashboard/components/PaymentDueList";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";

const CARD_CLASS =
  "surface-card min-w-0 p-5 sm:p-6";

export default function DashboardPage() {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const dashboard = useDashboard({ selectedYear });

  return (
    <main className="dashboard-theme min-h-screen overflow-x-hidden bg-[var(--dashboard-bg)]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <DashboardHeader selectedYear={selectedYear} onYearChange={setSelectedYear} />

        <KPIGrid metrics={dashboard.metrics} />

        <div className={CARD_CLASS}>
          <RevenueChart data={dashboard.revenueSeries} />
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={CARD_CLASS}>
            <TodaySchedule items={dashboard.todaysSchedule} />
          </div>
          <div className={CARD_CLASS}>
            <PaymentDueList
              title="Payments Due Soon"
              description="The next unpaid amounts coming due."
              emptyMessage="No upcoming payments are due."
              items={dashboard.paymentsDueSoon}
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={CARD_CLASS}>
            <UpcomingJobs items={dashboard.upcomingJobs} />
          </div>
          <div className={CARD_CLASS}>
            <PaymentDueList
              title="Late Payments"
              description="Unpaid amounts past their due date."
              emptyMessage="No late payments."
              items={dashboard.latePayments}
              late
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:gap-6">
          <div className={CARD_CLASS}>
            <IncomeByCategory items={dashboard.incomeByCategory} />
          </div>
          <div className={CARD_CLASS}>
            <ExpenseByCategory items={dashboard.expenseByCategory} />
          </div>
        </div>
      </div>
    </main>
  );
}
