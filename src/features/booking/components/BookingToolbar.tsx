type BookingToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  paymentStatus: string;
  onPaymentStatusChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
};

export default function BookingToolbar({
  search,
  onSearchChange,
  status,
  onStatusChange,
  paymentStatus,
  onPaymentStatusChange,
  sort,
  onSortChange,
}: BookingToolbarProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-4 shadow-sm lg:flex-row lg:items-center">
      <input
        type="text"
        placeholder="Search bookings..."
        className="w-full rounded-xl border border-zinc-300 px-4 py-2 lg:flex-1"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select
        className="rounded-xl border border-zinc-300 px-4 py-2"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">All Statuses</option>
        <option value="Scheduled">Scheduled</option>
        <option value="Completed">Completed</option>
        <option value="Cancelled">Cancelled</option>
      </select>

      <select
        className="rounded-xl border border-zinc-300 px-4 py-2"
        value={paymentStatus}
        onChange={(e) => onPaymentStatusChange(e.target.value)}
      >
        <option value="">All Payment Status</option>
        <option value="Outstanding">Outstanding</option>
        <option value="Partial Paid">Partial Paid</option>
        <option value="Fully Paid">Fully Paid</option>
        <option value="Cancelled">Cancelled</option>
      </select>

      <select
        className="rounded-xl border border-zinc-300 px-4 py-2"
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="date-asc">Date Ascending</option>
        <option value="date-desc">Date Descending</option>
      </select>
    </div>
  );
}
