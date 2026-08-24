import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type DashboardHeaderProps = {
  onCustomize: () => void;
};

export default function DashboardHeader({ onCustomize }: DashboardHeaderProps) {
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short" }).format(new Date());
  return (
    <header className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="page-title">Dashboard</h1>
        <p className="mt-1 text-sm font-medium text-[var(--dashboard-muted-text)] lg:hidden">{date}</p>
        <p className="mt-2 hidden max-w-xl text-sm leading-6 text-[var(--dashboard-muted-text)] lg:block lg:text-base">
          See your income, expenses, payments, and upcoming work.
        </p>
      </div>
      <Button type="button" variant="ghost" size="sm" className="hidden shrink-0 lg:inline-flex" onClick={onCustomize}>
        <Settings2 className="size-4" aria-hidden="true" />
        Customize dashboard
      </Button>
    </header>
  );
}
