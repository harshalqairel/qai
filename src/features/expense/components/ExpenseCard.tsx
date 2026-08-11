import { Expense } from "@/features/expense/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import DeleteAction from "@/components/system/DeleteAction";
import { categoryColorCss } from "@/features/category/constants";

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
  categoryColor: string;
  bookingDetails?: ExpenseBookingDetails | null;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => boolean | Promise<boolean>;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
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
  categoryColor,
  bookingDetails,
  onEdit,
  onDelete,
}: ExpenseCardProps) {
  const isBookingExpense = expense.expenseType === "Booking Expense";

  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{formatDate(expense.date)}</p>
          <h2 className="mt-1 flex items-center gap-2 font-bold text-foreground">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColorCss(categoryColor, expense.categoryId) }} aria-hidden="true" />
            <span className="truncate">{categoryName}</span>
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-bold tracking-tight text-foreground tabular-nums">{formatRupiah(expense.amount)}</p>
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_BADGE[expense.expenseType] ?? "border border-border bg-muted text-muted-foreground"}`}>
            {isBookingExpense ? "Booking expense" : "General expense"}
          </span>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-5 text-foreground">{expense.notes || "No description"}</p>
      <p className="mt-2 truncate text-sm text-muted-foreground">
        {isBookingExpense
          ? bookingDetails
            ? `${bookingDetails.customerName} · ${bookingDetails.serviceName}`
            : "Booking not found"
          : expense.vendor || "General business expense"}
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => onEdit(expense)}
          className="min-h-10 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          View / Edit
        </button>
        <DeleteAction
          itemName="this expense"
          onConfirm={() => onDelete(expense)}
          successMessage="Expense deleted."
          errorMessage="Could not delete the expense. Try again."
          triggerClassName="h-10 px-3"
          confirmLabel="Delete expense"
        />
      </div>
    </article>
  );
}
