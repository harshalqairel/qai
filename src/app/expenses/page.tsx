"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { suggestCategoryColor } from "@/features/category/constants";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";
import { firstBookingSession, instantParts } from "@/features/booking/utils/bookingSessions";

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
  const expenseData = useExpenses();
  const bookingData = useBookings();
  const customerData = useCustomers();
  const serviceData = useServices();
  const categoryData = useExpenseCategories();
  const { expenses, createExpense, updateExpense, deleteExpense } = expenseData;
  const { bookings } = bookingData;
  const { customers } = customerData;
  const { services } = serviceData;
  const { categories } = categoryData;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const handledQuickCreate = useRef(false);

  useEffect(() => {
    if (handledQuickCreate.current || expenseData.isLoading) return;
    handledQuickCreate.current = true;
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      const timer = window.setTimeout(() => {
        setSelectedExpense(null);
        setDialogOpen(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [expenseData.isLoading]);
  const [sort, setSort] = useState("newest");

  const bookingOptions = useMemo<BookingOption[]>(() => {
    return bookings.map((booking) => {
      const customer = customers.find((item) => item.id === booking.customerId);
      const service = services.find((item) => item.id === booking.serviceId);
      const customerName = customer?.name ?? "Client not found";
      const serviceName = service?.name ?? "Service not found";
      const session = firstBookingSession(booking);
      const start = instantParts(session.startAt, bookingData.timezone);
      const end = instantParts(session.endAt, bookingData.timezone);
      const bookingDate = formatBookingDate(start.date);

      return {
        id: booking.id,
        customerName,
        serviceName,
        bookingDateLabel: bookingDate,
        bookingDateKey: start.date,
        startTime: start.time,
        endTime: end.time,
        label: `${customerName} · ${serviceName} · ${bookingDate}`,
      };
    });
  }, [bookings, customers, services, bookingData.timezone]);

  const bookingDisplayMap = useMemo(
    () => new Map(bookingOptions.map((option) => [option.id, option])),
    [bookingOptions],
  );

  const keyword = search.trim().toLowerCase();
  const categoryNameById = new Map(categories.map((item) => [item.id, item.name]));
  const categoryColorById = new Map(categories.map((item) => [item.id, item.color]));
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

  const dataSources = [expenseData, bookingData, customerData, serviceData, categoryData];
  if (dataSources.some((source) => source.isLoading)) return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  if (dataSources.some((source) => source.loadError)) return (
    <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => dataSources.forEach((source) => source.retry())} /></div></main>
  );

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
            onAdd={() => {
              setSelectedExpense(null);
              setDialogOpen(true);
            }}
            getBookingDetails={(id) => bookingDisplayMap.get(id) ?? null}
            getCategoryName={(categoryId) => categoryNameById.get(categoryId) ?? "Category not found"}
            getCategoryColor={(categoryId) => categoryColorById.get(categoryId) ?? "category-slate"}
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
        onQuickCreateCategory={(name) => categoryData.createCategoryAndReturn({
          name,
          color: suggestCategoryColor(categories.map((category) => category.color)),
        })}
        onClose={() => {
          setDialogOpen(false);
          setSelectedExpense(null);
        }}
        onCreate={(input) => createExpense(input)}
        onUpdate={(input) => updateExpense(input)}
      />
    </>
  );
}
