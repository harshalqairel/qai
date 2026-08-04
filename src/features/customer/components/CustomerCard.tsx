import { Customer } from "@/features/customer/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import DeleteAction from "@/components/system/DeleteAction";

type CustomerWithStats = Customer & {
  bookingsCount: number;
  lifetimeRevenue: number;
  outstandingBalance: number;
  upcomingBooking: string | null;
};

type CustomerCardProps = {
  customer: CustomerWithStats;
  onEdit: (customer: CustomerWithStats) => void;
  onDelete: (customer: CustomerWithStats) => boolean;
};

export default function CustomerCard({
  customer,
  onEdit,
  onDelete,
}: CustomerCardProps) {
  return (
    <div
      className="
        rounded-xl
        border
        border-zinc-200
        bg-white
        p-5 sm:p-6
        shadow-sm
      "
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{customer.name}</h2>

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

      <div className="mt-5 flex gap-3 border-t border-border pt-5">
        <button
          onClick={() => onEdit(customer)}
          className="
            min-h-10 rounded-lg
            border border-border bg-white
            px-4
            py-2
            font-semibold
            text-foreground
            transition
            hover:bg-muted
          "
        >
          Edit
        </button>

        <DeleteAction
          itemName="this customer"
          onConfirm={() => onDelete(customer)}
          successMessage="Customer deleted."
          errorMessage="Could not delete the customer. Try again."
        />
      </div>
    </div>
  );
}
