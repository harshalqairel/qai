type PopularServiceItem = { id: string; name: string; count: number };

type Props = { items: PopularServiceItem[] };

export default function PopularServices({ items }: Props) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Popular Services</h3>
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">No services yet.</div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3">
              <div>
                <div className="font-medium text-slate-900">{s.name}</div>
                <div className="text-sm text-zinc-600">{s.count} bookings</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
