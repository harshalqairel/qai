import ReportPeriodSelector from "@/features/reports/ReportPeriodSelector";
import type { ReportPeriodInput } from "@/features/reports/financialReport";

type DashboardHeaderProps = {
  period: ReportPeriodInput;
  currentMonth: string;
  resolvedLabel: string;
  onPeriodChange: (period: ReportPeriodInput) => void;
};

export default function DashboardHeader({
  period,
  currentMonth,
  resolvedLabel,
  onPeriodChange,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--dashboard-income)]">
          Business overview
        </p>
        <h1 className="page-title mt-2">
          Dashboard
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--dashboard-muted-text)] sm:text-base">
          A clear view of your money, payments, and upcoming work.
        </p>
      </div>

      <ReportPeriodSelector value={period} currentMonth={currentMonth} resolvedLabel={resolvedLabel} onChange={onPeriodChange} />
    </header>
  );
}
