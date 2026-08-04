"use client";

import { useMemo, useState } from "react";
import ExpenseHeader from "@/features/expense/components/ExpenseHeader";
import ExpenseToolbar from "@/features/expense/components/ExpenseToolbar";
import ExpenseList from "@/features/expense/components/ExpenseList";
import ExpenseDialog from "@/features/expense/components/ExpenseDialog";
import type { ExpenseBookingDetails } from "@/features/expense/components/ExpenseCard";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { Expense } from "@/features/expense/types";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";

type BookingOption = ExpenseBookingDetails & {
  id: string;
  label: string;
};

function formatBookingDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ExpensesPage() {
  const { expenses, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { bookings } = useBookings();
  const { customers } = useCustomers();
  const { services } = useServices();
  const { categories } = useExpenseCategories();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [sort, setSort] = useState("newest");

  const bookingOptions = useMemo<BookingOption[]>(() => {
    return bookings.map((booking) => {
      const customer = customers.find((item) => item.id === booking.customerId);
      const service = services.find((item) => item.id === booking.serviceId);
      const customerName = customer?.name ?? "Customer not found";
      const serviceName = service?.name ?? "Service not found";
      const bookingDate = formatBookingDate(booking.bookingDate);

      return {
        id: booking.id,
        customerName,
        serviceName,
        bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        label: `${customerName} · ${serviceName} · ${bookingDate}`,
      };
    });
  }, [bookings, customers, services]);

  const bookingDisplayMap = useMemo(
    () => new Map(bookingOptions.map((option) => [option.id, option])),
    [bookingOptions],
  );

  const keyword = search.trim().toLowerCase();
  const categoryNameById = new Map(categories.map((item) => [item.id, item.name]));
  const filtered = expenses.filter((expense) => {
    const matchesSearch =
      keyword === "" ||
      (categoryNameById.get(expense.categoryId) ?? "Category not found").toLowerCase().includes(keyword) ||
      expense.vendor.toLowerCase().includes(keyword) ||
      expense.notes.toLowerCase().includes(keyword);
    const matchesCategory = category === "" || expense.categoryId === category;
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
      <main className="min-h-screen">
        <div className="page-shell">
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
            categories={categories}
          />
          <ExpenseList
            expenses={sorted}
            getBookingDetails={(id) => bookingDisplayMap.get(id) ?? null}
            getCategoryName={(categoryId) => categoryNameById.get(categoryId) ?? "Category not found"}
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
        categories={categories}
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
