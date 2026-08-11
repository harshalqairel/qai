import { Expense } from "@/features/expense/types";
import ExpenseCard, { ExpenseBookingDetails } from "./ExpenseCard";
import ExpenseTable from "./ExpenseTable";
import EmptyState from "@/components/system/EmptyState";
import { ReceiptText } from "lucide-react";

type ExpenseListProps = {
  expenses: Expense[];
  onAdd: () => void;
  getBookingDetails: (bookingId: string) => ExpenseBookingDetails | null;
  getCategoryName: (categoryId: string) => string;
  getCategoryColor: (categoryId: string) => string;
  onEdit: (expense: Expense) => void;
  onDelete: (expense: Expense) => boolean | Promise<boolean>;
};

export default function ExpenseList({ expenses, onAdd, getBookingDetails, getCategoryName, getCategoryColor, onEdit, onDelete }: ExpenseListProps) {
  if (expenses.length === 0) {
    return <EmptyState icon={ReceiptText} title="No expenses recorded in this period." description="Add an expense to start tracking what you spend." actionLabel="Add expense" onAction={onAdd} />;
  }

  return (
    <>
      <ExpenseTable
        expenses={expenses}
        getBookingDetails={getBookingDetails}
        getCategoryName={getCategoryName}
        getCategoryColor={getCategoryColor}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <div className="space-y-3 md:hidden">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            categoryName={getCategoryName(expense.categoryId)}
            categoryColor={getCategoryColor(expense.categoryId)}
            bookingDetails={expense.bookingId ? getBookingDetails(expense.bookingId) : null}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </>
  );
}
