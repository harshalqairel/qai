import KPICard from "./KPICard";
import type { KPI } from "@/features/dashboard/hooks/useDashboard";

type KPIGridProps = { metrics: KPI[]; periodQuery?: string };

export default function KPIGrid({ metrics, periodQuery }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {metrics.map((metric) => (
        <KPICard key={metric.label} metric={metric} periodQuery={periodQuery} />
      ))}
    </div>
  );
}
