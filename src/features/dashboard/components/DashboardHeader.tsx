import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

type DashboardHeaderProps = {
  selectedYear: number;
  onYearChange: (year: number) => void;
};

export default function DashboardHeader({
  selectedYear,
  onYearChange,
}: DashboardHeaderProps) {
  const currentYear = new Date().getFullYear();

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

      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        <Button
          variant="outline"
          className="h-10 w-10 border-[var(--dashboard-border)] bg-white p-0 text-[var(--dashboard-text)] hover:bg-[var(--dashboard-surface-muted)]"
          onClick={() => onYearChange(selectedYear - 1)}
          aria-label="Previous year"
          title="Previous year"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <span className="flex h-10 min-w-20 items-center justify-center rounded-xl border border-[var(--dashboard-border)] bg-white px-4 text-sm font-semibold text-[var(--dashboard-text)]">
          {selectedYear}
        </span>
        <Button
          variant="outline"
          className="h-10 w-10 border-[var(--dashboard-border)] bg-white p-0 text-[var(--dashboard-text)] hover:bg-[var(--dashboard-surface-muted)]"
          onClick={() => onYearChange(selectedYear + 1)}
          aria-label="Next year"
          title="Next year"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
        {selectedYear !== currentYear && (
          <Button
            variant="outline"
            className="h-10 w-full border-[var(--dashboard-border)] bg-white text-[var(--dashboard-text)] hover:bg-[var(--dashboard-surface-muted)] sm:w-auto"
            onClick={() => onYearChange(currentYear)}
          >
            This year
          </Button>
        )}
      </div>
    </header>
  );
}
