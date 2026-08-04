import { Expense } from "@/features/expense/types";
import ExpenseCard, { ExpenseBookingDetails } from "./ExpenseCard";

type ExpenseListProps = {
  expenses: Expense[];
  getBookingDetails: (bookingId: string) => ExpenseBookingDetails | null;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
};

export default function ExpenseList({ expenses, getBookingDetails, onEdit, onDelete }: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <div className="empty-state">
        <h3 className="text-xl font-semibold text-zinc-800">No expenses yet</h3>
        <p className="mt-2 text-zinc-500">
          Click <strong>Add Expense</strong> to record your first expense.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {expenses.map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          bookingDetails={expense.bookingId ? getBookingDetails(expense.bookingId) : null}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
