import ReportPeriodSelector from "@/features/reports/ReportPeriodSelector";
import type { ReportPeriodInput } from "@/features/reports/financialReport";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  period: ReportPeriodInput;
  currentMonth: string;
  resolvedLabel: string;
  onPeriodChange: (period: ReportPeriodInput) => void;
  onCustomize: () => void;
};

export default function DashboardHeader({
  period,
  currentMonth,
  resolvedLabel,
  onPeriodChange,
  onCustomize,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <h1 className="page-title">Dashboard</h1>
          <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={onCustomize}>
            <Settings2 className="size-4" aria-hidden="true" />
            <span className="sm:hidden">Customize</span>
            <span className="hidden sm:inline">Customize dashboard</span>
          </Button>
        </div>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--dashboard-muted-text)] sm:text-base">
          See your income, expenses, payments, and upcoming work.
        </p>
      </div>

      <div className="flex shrink-0 sm:justify-end">
        <ReportPeriodSelector value={period} currentMonth={currentMonth} resolvedLabel={resolvedLabel} onChange={onPeriodChange} />
      </div>
    </header>
  );
}
