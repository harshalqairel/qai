type KPICardProps = { label: string; value: string | number; sub?: string };

function formatRupiah(value: number) {
  return 'Rp ' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export default function KPICard({ label, value, sub }: KPICardProps) {
  const isCurrency = sub === "Rp";
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <div className="text-2xl font-semibold text-slate-900">{isCurrency && typeof value === 'number' ? formatRupiah(value) : value}</div>
        {sub && !isCurrency && <div className="text-sm text-zinc-500">{sub}</div>}
      </div>
    </div>
  );
}
