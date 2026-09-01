import ListSortControl from "@/components/system/ListSortControl";

export type BookingSort =
  | "newest" | "oldest"
  | "client-asc" | "client-desc"
  | "date-asc" | "date-desc"
  | "booking-status-asc" | "booking-status-desc"
  | "payment-status-asc" | "payment-status-desc"
  | "invoice-status-asc" | "invoice-status-desc"
  | "amount-asc" | "amount-desc"
  | "profit-asc" | "profit-desc";

type BookingToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  paymentStatus: string;
  onPaymentStatusChange: (value: string) => void;
  sort: BookingSort;
  onSortChange: (value: BookingSort) => void;
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
    <div className="filter-bar grid grid-cols-2 lg:flex">
      <input
        type="text"
        placeholder="Search bookings..."
        className="native-control col-span-2 lg:flex-1"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select
        className="native-control min-w-0 lg:w-auto"
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
      >
        <option value="">All statuses</option>
        <option value="Scheduled">Scheduled</option>
        <option value="Completed">Completed</option>
        <option value="Cancelled">Cancelled</option>
      </select>

      <select
        className="native-control min-w-0 lg:w-auto"
        value={paymentStatus}
        onChange={(e) => onPaymentStatusChange(e.target.value)}
      >
        <option value="">All payments</option>
        <option value="Outstanding">Unpaid</option>
        <option value="Partial Paid">Part paid</option>
        <option value="Overdue">Overdue</option>
        <option value="Fully Paid">Paid</option>
        <option value="Cancelled">Cancelled</option>
      </select>

      <ListSortControl
        className="col-span-2 lg:w-56"
        value={sort}
        onChange={onSortChange}
        options={[
          { value: "newest", label: "Newest added" },
          { value: "oldest", label: "Oldest added" },
          { value: "date-asc", label: "Schedule · earliest" },
          { value: "date-desc", label: "Schedule · latest" },
          { value: "client-asc", label: "Client · A–Z" },
          { value: "client-desc", label: "Client · Z–A" },
          { value: "booking-status-asc", label: "Booking status · A–Z" },
          { value: "payment-status-asc", label: "Payment status · A–Z" },
          { value: "invoice-status-asc", label: "Invoice status · A–Z" },
          { value: "amount-desc", label: "Amount · highest" },
          { value: "amount-asc", label: "Amount · lowest" },
          { value: "profit-desc", label: "Profit · highest" },
          { value: "profit-asc", label: "Profit · lowest" },
        ]}
      />
    </div>
  );
}
