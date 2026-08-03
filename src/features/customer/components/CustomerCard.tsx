import { Customer } from "@/features/customer/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type CustomerWithStats = Customer & {
  bookingsCount: number;
  lifetimeRevenue: number;
  outstandingBalance: number;
  upcomingBooking: string | null;
};

type CustomerCardProps = {
  customer: CustomerWithStats;
  onEdit: (customer: CustomerWithStats) => void;
  onDelete: (customer: CustomerWithStats) => void;
};

export default function CustomerCard({
  customer,
  onEdit,
  onDelete,
}: CustomerCardProps) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-zinc-200
        bg-white
        p-7
        shadow-sm
        transition-all
        duration-200
        hover:-translate-y-1
        hover:shadow-xl
      "
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{customer.name}</h2>

          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-900">Phone:</span>{" "}
              {customer.phone}
            </p>
            {customer.email && (
              <p>
                <span className="font-semibold text-slate-900">Email:</span>{" "}
                {customer.email}
              </p>
            )}
            {customer.instagram && (
              <p>
                <span className="font-semibold text-slate-900">Instagram:</span>{" "}
                {customer.instagram}
              </p>
            )}
          </div>
        </div>
      </div>

      {customer.notes && (
        <p className="mt-8 text-base leading-7 text-slate-600">
          {customer.notes}
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
        <div className="rounded-2xl bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Bookings Count</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{customer.bookingsCount}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Lifetime Revenue</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{formatRupiah(customer.lifetimeRevenue)}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Outstanding Balance</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{formatRupiah(customer.outstandingBalance)}</p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-3">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Upcoming Booking</p>
          <p className="mt-1 text-base font-semibold text-slate-900">{customer.upcomingBooking ?? "No upcoming booking"}</p>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => onEdit(customer)}
          className="
            rounded-xl
            bg-slate-900
            px-5
            py-3
            font-semibold
            text-white
            transition
            hover:bg-slate-700
          "
        >
          Edit
        </button>

        <button
          onClick={() => onDelete(customer)}
          className="
            rounded-xl
            border
            border-red-300
            bg-white
            px-5
            py-3
            font-semibold
            text-red-600
            transition
            hover:bg-red-50
          "
        >
          Delete
        </button>
      </div>
    </div>
  );
}
