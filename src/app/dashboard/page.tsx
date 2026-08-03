"use client";

import { useState } from "react";
import DashboardHeader from "@/features/dashboard/components/DashboardHeader";
import KPIGrid from "@/features/dashboard/components/KPIGrid";
import TodaySchedule from "@/features/dashboard/components/TodaySchedule";
import UpcomingBookings from "@/features/dashboard/components/UpcomingBookings";
import RevenueChart from "@/features/dashboard/components/RevenueChart";
import BookingStatusChart from "@/features/dashboard/components/BookingStatusChart";
import RevenueByServiceCategory from "@/features/dashboard/components/RevenueByServiceCategory";
import ExpenseByCategory from "@/features/dashboard/components/ExpenseByCategory";
import QuickActions from "@/features/dashboard/components/QuickActions";
import ActivityFeed from "@/features/dashboard/components/ActivityFeed";
import { useDashboard } from "@/features/dashboard/hooks/useDashboard";

export default function DashboardPage() {
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => new Date());
  const [chartRange] = useState<"year">("year");

  const dashboard = useDashboard({ selectedMonth, chartRange });

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <DashboardHeader
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onToday={() => {
            const now = new Date();
            setSelectedMonth(new Date(now.getFullYear(), 0, 1));
          }}
        />

        <KPIGrid metrics={dashboard.metrics} />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-6 md:col-span-2 lg:col-span-2">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <TodaySchedule items={dashboard.todaysSchedule} />
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <RevenueChart data={dashboard.revenueSeries} />
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <BookingStatusChart counts={dashboard.statusCounts} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <UpcomingBookings items={dashboard.upcomingBookings} />
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <RevenueByServiceCategory items={dashboard.revenueByCategory} />
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <ExpenseByCategory items={dashboard.expenseByCategory} />
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <QuickActions />
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <ActivityFeed items={dashboard.activityFeed} />
        </div>
      </div>
    </main>
  );
}
