import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import SortableTableHeader from "@/components/system/SortableTableHeader";
import { categoryColorCss } from "@/features/category/constants";
import type { Expense } from "@/features/expense/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import type { ExpenseBookingDetails } from "./ExpenseCard";
import ExpenseActions from "./ExpenseActions";
import type { ExpenseSort } from "./ExpenseToolbar";

type ExpenseTableProps = {
  expenses: Expense[];
  getBookingDetails: (bookingId: string) => ExpenseBookingDetails | null;
  getCategoryName: (categoryId: string) => string;
  getCategoryColor: (categoryId: string) => string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => boolean | Promise<boolean>;
  sort: ExpenseSort;
  onSortChange: (sort: ExpenseSort) => void;
};

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ExpenseTable({
  expenses,
  getBookingDetails,
  getCategoryName,
  getCategoryColor,
  onEdit,
  onDelete,
  sort,
  onSortChange,
}: ExpenseTableProps) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:block">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortableTableHeader className="pl-4" label="Date" sort={sort} ascending="date-asc" descending="date-desc" onSortChange={onSortChange} />
            <SortableTableHeader label="Category" sort={sort} ascending="category-asc" descending="category-desc" onSortChange={onSortChange} />
            <TableHead className="w-[24%]">Description</TableHead>
            <SortableTableHeader className="w-[22%]" label="Booking / paid to" sort={sort} ascending="target-asc" descending="target-desc" onSortChange={onSortChange} />
            <SortableTableHeader label="Payment method" sort={sort} ascending="payment-asc" descending="payment-desc" onSortChange={onSortChange} />
            <SortableTableHeader label="Amount" sort={sort} ascending="amount-asc" descending="amount-desc" onSortChange={onSortChange} align="right" />
            <TableHead className="pr-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const booking = expense.bookingId ? getBookingDetails(expense.bookingId) : null;
            const isBookingExpense = expense.expenseType === "Booking Expense";
            return (
              <TableRow
                key={expense.id}
                className="cursor-pointer focus-within:bg-accent/45"
                onClick={() => onEdit(expense)}
              >
                <TableCell className="pl-4 font-medium">{formatDate(expense.date)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColorCss(getCategoryColor(expense.categoryId), expense.categoryId) }}
                      aria-hidden="true"
                    />
                    {getCategoryName(expense.categoryId)}
                  </span>
                </TableCell>
                <TableCell className="max-w-64 whitespace-normal">
                  <p className="line-clamp-2 text-foreground">{expense.notes || "No description"}</p>
                  <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                    isBookingExpense
                      ? "border-blue-200 bg-blue-50 text-[var(--status-info)]"
                      : "border-teal-200 bg-teal-50 text-[var(--brand)]"
                  }`}>
                    {isBookingExpense ? "Booking expense" : "General expense"}
                  </span>
                </TableCell>
                <TableCell className="max-w-60 whitespace-normal">
                  {isBookingExpense ? (
                    booking ? (
                      <div>
                        <p className="font-medium text-foreground">{booking.customerName}</p>
                        <p className="text-xs text-muted-foreground">{booking.serviceName}</p>
                      </div>
                    ) : <span className="text-muted-foreground">Booking not found</span>
                  ) : (
                    <span>{expense.vendor || "General business"}</span>
                  )}
                </TableCell>
                <TableCell>{expense.paymentMethod}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{formatRupiah(expense.amount)}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                    <ExpenseActions expense={expense} onEdit={onEdit} onDelete={onDelete} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
