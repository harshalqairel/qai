import { Expense } from "@/features/expense/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type ExpenseCardProps = {
  expense: Expense;
  bookingLabel?: string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TYPE_BADGE: Record<string, string> = {
  "Booking Expense": "bg-violet-100 text-violet-700",
  "Business Expense": "bg-sky-100 text-sky-700",
};

export default function ExpenseCard({ expense, bookingLabel, onEdit, onDelete }: ExpenseCardProps) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl">
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-start">
        <div className="space-y-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{expense.category}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${TYPE_BADGE[expense.expenseType] ?? "bg-zinc-100 text-zinc-700"}`}>
                {expense.expenseType}
              </span>
              {expense.vendor && (
                <span className="inline-flex rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-700">
                  {expense.vendor}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">Date</p>
              <p>{formatDate(expense.date)}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Payment Method</p>
              <p>{expense.paymentMethod}</p>
            </div>
            {expense.expenseType === "Booking Expense" && (
              <div>
                <p className="font-semibold text-slate-900">Booking</p>
                <p>{bookingLabel ?? expense.bookingId ?? "—"}</p>
              </div>
            )}
          </div>

          {expense.notes && (
            <p className="text-sm text-slate-600">{expense.notes}</p>
          )}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-900">Amount</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{formatRupiah(expense.amount)}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onEdit(expense)}
          className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(expense)}
          className="rounded-xl border border-red-300 bg-white px-5 py-3 font-semibold text-red-600 transition hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
