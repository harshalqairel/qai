type RecentCustomersProps = { items: { id: string; name: string; createdAt: number }[] };

export default function RecentCustomers({ items }: RecentCustomersProps) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-900">Recent Customers</h3>
      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">No customers yet.</div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-3">
              <div>
                <div className="font-medium text-slate-900">{c.name}</div>
                <div className="text-sm text-zinc-600">{new Date(c.createdAt).toLocaleDateString()}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
