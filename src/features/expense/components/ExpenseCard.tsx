import { formatBookingTimeRange } from "@/features/booking/utils/bookingDateRange";
import { Expense } from "@/features/expense/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import DeleteAction from "@/components/system/DeleteAction";

export type ExpenseBookingDetails = {
  customerName: string;
  serviceName: string;
  bookingDateLabel: string;
  bookingDateKey: string;
  startTime: string;
  endTime: string;
};

type ExpenseCardProps = {
  expense: Expense;
  categoryName: string;
  bookingDetails?: ExpenseBookingDetails | null;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => boolean | Promise<boolean>;
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
  "Booking Expense": "border border-blue-200 bg-blue-50 text-[var(--status-info)]",
  "Business Expense": "border border-teal-200 bg-teal-50 text-[var(--brand)]",
};

export default function ExpenseCard({
  expense,
  categoryName,
  bookingDetails,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{categoryName}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_BADGE[expense.expenseType] ?? "border border-border bg-muted text-muted-foreground"}`}>
              {expense.expenseType}
            </span>
            {expense.vendor && (
              <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {expense.vendor}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-3xl">
            {formatRupiah(expense.amount)}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-foreground">Date</dt>
          <dd className="mt-1 text-muted-foreground">{formatDate(expense.date)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">Payment method</dt>
          <dd className="mt-1 text-muted-foreground">{expense.paymentMethod}</dd>
        </div>
        {expense.vendor && (
          <div>
            <dt className="font-semibold text-foreground">Vendor</dt>
            <dd className="mt-1 text-muted-foreground">{expense.vendor}</dd>
          </div>
        )}
      </dl>

      {expense.expenseType === "Booking Expense" && (
        <section className="mt-5 rounded-lg border border-border bg-muted/55 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Booking</p>
          {bookingDetails ? (
            <div className="mt-2">
              <p className="font-semibold text-foreground">{bookingDetails.customerName}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{bookingDetails.serviceName}</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {bookingDetails.bookingDateLabel} · {formatBookingTimeRange(
                  bookingDetails.bookingDateKey,
                  bookingDetails.startTime,
                  bookingDetails.endTime,
                )}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-muted-foreground">Booking not found</p>
          )}
        </section>
      )}

      {expense.notes && (
        <p className="mt-5 border-t border-border pt-5 text-sm leading-6 text-muted-foreground">
          {expense.notes}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={() => onEdit(expense)}
          className="min-h-10 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Edit
        </button>
        <DeleteAction
          itemName="this expense"
          onConfirm={() => onDelete(expense)}
          successMessage="Expense deleted."
          errorMessage="Could not delete the expense. Try again."
        />
      </div>
    </article>
  );
}
