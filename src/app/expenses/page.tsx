"use client";

import { useMemo, useState } from "react";
import ExpenseHeader from "@/features/expense/components/ExpenseHeader";
import ExpenseToolbar from "@/features/expense/components/ExpenseToolbar";
import ExpenseList from "@/features/expense/components/ExpenseList";
import ExpenseDialog from "@/features/expense/components/ExpenseDialog";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { Expense } from "@/features/expense/types";

export default function ExpensesPage() {
  const { expenses, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { bookings } = useBookings();
  const { customers } = useCustomers();
  const { services } = useServices();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [sort, setSort] = useState("newest");

  // Build booking display labels: "CustomerName — ServiceName (Date)"
  const bookingOptions = useMemo(() => {
    return bookings.map((booking) => {
      const customer = customers.find((c) => c.id === booking.customerId);
      const service = services.find((s) => s.id === booking.serviceId);
      return {
        id: booking.id,
        label: `${customer?.name ?? "Unknown"} — ${service?.name ?? "Unknown"} (${booking.bookingDate})`,
      };
    });
  }, [bookings, customers, services]);

  const bookingLabelMap = useMemo(() => {
    return new Map(bookingOptions.map((opt) => [opt.id, opt.label]));
  }, [bookingOptions]);

  const keyword = search.trim().toLowerCase();

  const filtered = expenses.filter((expense) => {
    const matchesSearch =
      keyword === "" ||
      expense.category.toLowerCase().includes(keyword) ||
      expense.vendor.toLowerCase().includes(keyword) ||
      expense.notes.toLowerCase().includes(keyword);

    const matchesCategory = category === "" || expense.category === category;
    const matchesType = expenseType === "" || expense.expenseType === expenseType;

    return matchesSearch && matchesCategory && matchesType;
  });

  const sorted = [...filtered];
  switch (sort) {
    case "oldest":
      sorted.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "date-asc":
      sorted.sort((a, b) => a.date.localeCompare(b.date));
      break;
    case "date-desc":
      sorted.sort((a, b) => b.date.localeCompare(a.date));
      break;
    case "amount-asc":
      sorted.sort((a, b) => a.amount - b.amount);
      break;
    case "amount-desc":
      sorted.sort((a, b) => b.amount - a.amount);
      break;
    case "newest":
    default:
      sorted.sort((a, b) => b.createdAt - a.createdAt);
  }

  return (
    <>
      <main className="min-h-screen bg-zinc-100">
        <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <ExpenseHeader
            onAdd={() => {
              setSelectedExpense(null);
              setDialogOpen(true);
            }}
          />

          <ExpenseToolbar
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            expenseType={expenseType}
            onExpenseTypeChange={setExpenseType}
            sort={sort}
            onSortChange={setSort}
          />

          <ExpenseList
            expenses={sorted}
            getBookingLabel={(id) => bookingLabelMap.get(id) ?? id}
            onEdit={(expense) => {
              setSelectedExpense(expense);
              setDialogOpen(true);
            }}
            onDelete={(expense) => deleteExpense(expense.id)}
          />
        </div>
      </main>

      <ExpenseDialog
        open={dialogOpen}
        expense={selectedExpense}
        bookingOptions={bookingOptions}
        onClose={() => {
          setDialogOpen(false);
          setSelectedExpense(null);
        }}
        onCreate={(input) => {
          createExpense(input);
          setDialogOpen(false);
        }}
        onUpdate={(input) => {
          updateExpense(input);
          setDialogOpen(false);
          setSelectedExpense(null);
        }}
      />
    </>
  );
}
