import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  selectedMonth: Date;
  onMonthChange: (d: Date) => void;
  onToday: () => void;
};

export default function DashboardHeader({ selectedMonth, onMonthChange, onToday }: DashboardHeaderProps) {
  const yearLabel = String(selectedMonth.getFullYear());

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Dashboard</h1>
        <p className="mt-1 text-base text-zinc-600 sm:mt-2 sm:text-lg">
          Payment-based business overview.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(new Date(selectedMonth.getFullYear() - 1, 0, 1))}
        >
          Previous Year
        </Button>
        <span className="rounded-2xl bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700">{yearLabel}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(new Date(selectedMonth.getFullYear() + 1, 0, 1))}
        >
          Next Year
        </Button>
        <Button variant="outline" size="sm" onClick={onToday}>
          This Year
        </Button>
      </div>
    </div>
  );
}
