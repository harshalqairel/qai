import { Booking } from "@/features/booking/types";
import { DerivedPaymentStatus } from "@/features/payment/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type BookingWithNames = Booking & {
  customerName: string;
  serviceName: string;
  paymentStatus: DerivedPaymentStatus;
  totalPaid: number;
  remainingAmount: number;
};

type BookingCardProps = {
  booking: BookingWithNames;
  onEdit: (booking: BookingWithNames) => void;
  onDelete: (booking: BookingWithNames) => void;
};

function formatBookingDate(date: string) {
  const parsed = new Date(date);
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function bookingStatusBadge(status: string) {
  const badgeClasses =
    status === "Scheduled"
      ? "bg-emerald-100 text-emerald-700"
      : status === "Completed"
      ? "bg-sky-100 text-sky-700"
      : "bg-red-100 text-red-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badgeClasses}`}>
      {status}
    </span>
  );
}

function paymentStatusBadge(status: DerivedPaymentStatus) {
  const badgeClasses =
    status === "Outstanding"
      ? "bg-zinc-200 text-zinc-700"
      : status === "Partial Paid"
      ? "bg-amber-100 text-amber-700"
      : status === "Fully Paid"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badgeClasses}`}>
      {status}
    </span>
  );
}

export default function BookingCard({ booking, onEdit, onDelete }: BookingCardProps) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-start">
        <div className="space-y-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{booking.customerName}</h2>
            <p className="mt-1 text-sm text-slate-600">{booking.serviceName}</p>
          </div>

          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">Date</p>
              <p>{formatBookingDate(booking.bookingDate)}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Time</p>
              <p>{booking.startTime} – {booking.endTime}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Location</p>
              <p>{booking.location}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Booking Status</p>
              {bookingStatusBadge(booking.bookingStatus)}
            </div>
            <div>
              <p className="font-semibold text-slate-900">Payment Status</p>
              {paymentStatusBadge(booking.paymentStatus)}
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Booked on</p>
            <p className="mt-1 text-slate-600">
              {new Date(booking.createdAt).toLocaleDateString("en-US", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Paid</p>
            <p className="mt-1 text-slate-600">{formatRupiah(booking.totalPaid)}</p>
            <p className="mt-1 text-sm text-zinc-500">Remaining: {formatRupiah(booking.remainingAmount)}</p>
          </div>
        </div>
      </div>

      {booking.notes && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-slate-900">Notes</p>
          <p className="mt-2 text-slate-600">{booking.notes}</p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onEdit(booking)}
          className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(booking)}
          className="rounded-xl border border-red-300 bg-white px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
