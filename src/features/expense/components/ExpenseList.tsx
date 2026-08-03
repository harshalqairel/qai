import { Expense } from "@/features/expense/types";
import ExpenseCard from "./ExpenseCard";

type ExpenseListProps = {
  expenses: Expense[];
  getBookingLabel: (bookingId: string) => string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => void;
};

export default function ExpenseList({ expenses, getBookingLabel, onEdit, onDelete }: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
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
          bookingLabel={expense.bookingId ? getBookingLabel(expense.bookingId) : undefined}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
