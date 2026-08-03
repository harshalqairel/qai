import KPICard from "./KPICard";
import type { KPI } from "@/features/dashboard/hooks/useDashboard";

type KPIGridProps = { metrics: KPI[] };

export default function KPIGrid({ metrics }: KPIGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <KPICard key={metric.label} metric={metric} />
      ))}
    </div>
  );
}
