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
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">
          Dashboard
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--dashboard-muted-text)] sm:text-base">
          See your income, expenses, payments, and upcoming work.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        <Button type="button" variant="ghost" size="sm" onClick={onCustomize}><Settings2 className="size-4" /> Customize dashboard</Button>
        <ReportPeriodSelector value={period} currentMonth={currentMonth} resolvedLabel={resolvedLabel} onChange={onPeriodChange} />
      </div>
    </header>
  );
}
