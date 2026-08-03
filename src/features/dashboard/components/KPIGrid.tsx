import KPICard from "./KPICard";
import type { KPI } from "@/features/dashboard/hooks/useDashboard";

type KPIGridProps = { metrics: KPI[] };

export default function KPIGrid({ metrics }: KPIGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {metrics.map((m) => (
        <KPICard key={m.label} label={m.label} value={m.value} sub={m.sub} />
      ))}
    </div>
  );
}
