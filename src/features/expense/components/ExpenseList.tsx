import { Expense } from "@/features/expense/types";
import ExpenseCard, { ExpenseBookingDetails } from "./ExpenseCard";
import EmptyState from "@/components/system/EmptyState";
import { ReceiptText } from "lucide-react";

type ExpenseListProps = {
  expenses: Expense[];
  getBookingDetails: (bookingId: string) => ExpenseBookingDetails | null;
  getCategoryName: (categoryId: string) => string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => boolean;
};

export default function ExpenseList({ expenses, getBookingDetails, getCategoryName, onEdit, onDelete }: ExpenseListProps) {
  if (expenses.length === 0) {
    return <EmptyState icon={ReceiptText} title="No expenses found." description="Add an expense when you are ready." />;
  }

  return (
    <div className="space-y-6">
      {expenses.map((expense) => (
        <ExpenseCard
          key={expense.id}
          expense={expense}
          categoryName={getCategoryName(expense.categoryId)}
          bookingDetails={expense.bookingId ? getBookingDetails(expense.bookingId) : null}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
