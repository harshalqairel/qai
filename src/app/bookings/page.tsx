"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import BookingHeader from "@/features/booking/components/BookingHeader";
import BookingToolbar from "@/features/booking/components/BookingToolbar";
import BookingTable from "@/features/booking/components/BookingTable";
import BookingDialog from "@/features/booking/components/BookingDialog";
import BookingFinancialDetailsDialog, {
  type BookingFinancialDetails,
} from "@/features/booking/components/BookingFinancialDetailsDialog";
import PaymentDialog from "@/features/payment/components/PaymentDialog";
import ExpenseDialog from "@/features/expense/components/ExpenseDialog";
import { Booking, CreateBookingCommand, UpdateBookingInput } from "@/features/booking/types";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { Payment } from "@/features/payment/types";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";
import { suggestCategoryColor } from "@/features/category/constants";
import { summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import { calculateBookingFinancials } from "@/features/booking/domain/bookingFinancials";
import {
  compareBookingsByFirstSession,
  firstBookingSession,
  formatSessionDate,
  sessionToFormValues,
} from "@/features/booking/utils/bookingSessions";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";
import { notify } from "@/lib/notifications";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";
import { invoiceRepository } from "@/features/invoice/invoice";
import type { BookingFormValues } from "@/features/booking/schema";

export default function BookingsPage() {
  const bookingData = useBookings();
  const customerData = useCustomers();
  const serviceData = useServices();
  const paymentData = usePayments();
  const expenseData = useExpenses();
  const expenseCategoryData = useExpenseCategories();
  const serviceCategoryData = useServiceCategories();
  const { bookings, createBooking, updateBooking, deleteBooking } = bookingData;
  const { customers } = customerData;
  const { services } = serviceData;
  const { payments, createPayment, updatePayment, deletePayment } = paymentData;
  const { expenses, createExpense, updateExpense } = expenseData;
  const { categories: expenseCategories } = expenseCategoryData;
  const { categories: serviceCategories } = serviceCategoryData;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBookingIdForPayment, setSelectedBookingIdForPayment] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentDefaultAmount, setPaymentDefaultAmount] = useState<number | undefined>();
  const [financialDetailsOpen, setFinancialDetailsOpen] = useState(false);
  const [selectedBookingForFinancialDetails, setSelectedBookingForFinancialDetails] =
    useState<BookingFinancialDetails | null>(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [selectedBookingIdForExpense, setSelectedBookingIdForExpense] = useState<string | null>(null);
  const [initialBookingValues, setInitialBookingValues] = useState<Partial<BookingFormValues> | undefined>();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const handledDeepLink = useRef(false);

  const paymentSummaries = useMemo(() => summarizeBookingPayments(bookings, payments), [bookings, payments]);
  const keyword = search.trim().toLowerCase();

  const bookingOptions = useMemo(() => bookings.map((booking) => {
    const customer = customers.find((item) => item.id === booking.customerId);
    const service = services.find((item) => item.id === booking.serviceId);
    return {
      id: booking.id,
      label: `${customer?.name ?? "Client not found"} · ${[booking.serviceSnapshot?.serviceName || service?.name || "Service not found", booking.serviceSnapshot?.variantLabel].filter(Boolean).join(" · ")} · ${formatSessionDate(firstBookingSession(booking), bookingData.timezone)}`,
    };
  }), [bookings, customers, services, bookingData.timezone]);

  const bookingsWithNames: BookingFinancialDetails[] = bookings.map((booking) => {
    const customer = customers.find((item) => item.id === booking.customerId);
    const service = services.find((item) => item.id === booking.serviceId);
    const effectiveServicePrice = booking.servicePrice > 0 ? booking.servicePrice : service?.price ?? 0;
    const paymentSummary = paymentSummaries[booking.id];
    const financials = calculateBookingFinancials({ ...booking, servicePrice: effectiveServicePrice }, payments, expenses);
    const directExpenses = financials.directExpenses;
    return {
      ...booking,
      servicePrice: effectiveServicePrice,
      customerName: customer?.name ?? "Client not found",
      serviceName: [booking.serviceSnapshot?.serviceName || service?.name || "Unknown Service", booking.serviceSnapshot?.variantLabel].filter(Boolean).join(" · "),
      paymentStatus: paymentSummary?.paymentStatus ?? "Outstanding",
      totalPaid: paymentSummary?.totalPaid ?? 0,
      remainingAmount: financials.outstanding,
      directExpenses,
      estimatedProfit: financials.estimatedJobProfit,
      cashPosition: financials.cashPosition,
    };
  });

  useEffect(() => {
    if (handledDeepLink.current || bookingData.isLoading) return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "1") {
        setSelectedBooking(null);
        const customerId = params.get("customer");
        setInitialBookingValues(customerId && customers.some((customer) => customer.id === customerId) ? { customerId } : undefined);
        setDialogOpen(true);
      }
      if (params.get("payment") === "outstanding") setPaymentStatusFilter("Outstanding");
      const bookingId = params.get("booking");
      if (bookingId) {
        const booking = bookingsWithNames.find((item) => item.id === bookingId);
        if (booking) {
          setSelectedBookingForFinancialDetails(booking);
          setFinancialDetailsOpen(true);
        }
      }
      handledDeepLink.current = true;
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [bookingData.isLoading, bookingsWithNames, customers]);

  const filteredBookings = bookingsWithNames.filter((booking) => {
    const matchesSearch =
      keyword === "" ||
      booking.customerName.toLowerCase().includes(keyword) ||
      booking.serviceName.toLowerCase().includes(keyword) ||
      booking.sessions.some((session) =>
        session.location.toLowerCase().includes(keyword) ||
        session.label.toLowerCase().includes(keyword) ||
        session.notes.toLowerCase().includes(keyword),
      ) ||
      booking.notes.toLowerCase().includes(keyword);

    const matchesBookingStatus = statusFilter === "" || booking.bookingStatus === statusFilter;
    const matchesPaymentStatus = paymentStatusFilter === "" || booking.paymentStatus === paymentStatusFilter;
    return matchesSearch && matchesBookingStatus && matchesPaymentStatus;
  });

  const sortedBookings = [...filteredBookings];
  switch (sort) {
    case "date-asc":
      sortedBookings.sort(compareBookingsByFirstSession);
      break;
    case "date-desc":
      sortedBookings.sort((a, b) => compareBookingsByFirstSession(b, a));
      break;
    case "oldest":
      sortedBookings.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "newest":
    default:
      sortedBookings.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  function openPaymentDialog(bookingId: string, payment?: Payment, defaultAmount?: number) {
    setSelectedBookingIdForPayment(bookingId);
    setEditingPayment(payment ?? null);
    setPaymentDefaultAmount(defaultAmount);
    setPaymentDialogOpen(true);
  }

  function closePaymentDialog() {
    setPaymentDialogOpen(false);
    setSelectedBookingIdForPayment(null);
    setEditingPayment(null);
    setPaymentDefaultAmount(undefined);
  }

  async function updateBookingStatus(booking: BookingFinancialDetails, bookingStatus: Booking["bookingStatus"]) {
    const succeeded = await updateBooking({
      id: booking.id,
      customerId: booking.customerId,
      serviceId: booking.serviceId,
      sessions: booking.sessions.map((session) => sessionToFormValues(session, bookingData.timezone)),
      servicePrice: booking.servicePrice,
      bookingStatus,
      fullPaymentDueDate: booking.fullPaymentDueDate,
      notes: booking.notes,
    });

    if (succeeded) {
      notify.success(`Booking marked as ${bookingStatus.toLowerCase()}.`);
    } else {
      notify.error("Could not update the booking status. Try again.");
    }

    return succeeded;
  }

  function openFinancialDetails(booking: BookingFinancialDetails) {
    setSelectedBookingForFinancialDetails(booking);
    setFinancialDetailsOpen(true);
  }

  function closeFinancialDetails() {
    setFinancialDetailsOpen(false);
    setSelectedBookingForFinancialDetails(null);
  }

  const dataSources = [bookingData, customerData, serviceData, paymentData, expenseData, expenseCategoryData, serviceCategoryData];
  if (dataSources.some((source) => source.isLoading)) return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  if (dataSources.some((source) => source.loadError)) return (
    <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => dataSources.forEach((source) => source.retry())} /></div></main>
  );

  return (
    <>
      <main className="min-h-screen">
        <div className="page-shell">
          <BookingHeader
            onAdd={() => {
              setSelectedBooking(null);
              setDialogOpen(true);
            }}
          />

          <BookingToolbar
            search={search}
            onSearchChange={setSearch}
            status={statusFilter}
            onStatusChange={setStatusFilter}
            paymentStatus={paymentStatusFilter}
            onPaymentStatusChange={setPaymentStatusFilter}
            sort={sort}
            onSortChange={setSort}
          />

          <BookingTable
            bookings={sortedBookings}
            onAdd={() => {
              setSelectedBooking(null);
              setDialogOpen(true);
            }}
            onEdit={(booking) => {
              setSelectedBooking(booking);
              setDialogOpen(true);
            }}
            onDelete={async (booking) => {
              const result = await deleteBooking(booking.id);
              if (result === "deleted") return true;
              if (result === "blocked") return "blocked";
              return false;
            }}
            onStatusChange={updateBookingStatus}
            onFinancialDetailsClick={openFinancialDetails}
            invoices={invoiceRepository.getAll()}
            timezone={bookingData.timezone}
          />
        </div>
      </main>

      <BookingDialog
        open={dialogOpen}
        booking={selectedBooking}
        initialValues={initialBookingValues}
        customers={customers}
        services={services}
        serviceCategories={serviceCategories}
        payments={payments}
        expenses={expenses}
        timezone={bookingData.timezone}
        onClose={() => {
          setDialogOpen(false);
          setSelectedBooking(null);
          setInitialBookingValues(undefined);
        }}
        onCreate={async (command: CreateBookingCommand) => {
          const created = await createBooking(command);
          if (created) await paymentData.retry();
          return created;
        }}
        onUpdate={(input: UpdateBookingInput) => updateBooking(input)}
        onAddPaymentClick={(bookingId, remainingAmount) =>
          openPaymentDialog(bookingId, undefined, remainingAmount)
        }
        onEditPaymentClick={(payment) => openPaymentDialog(payment.bookingId, payment)}
        onDeletePayment={(id) => deletePayment(id)}
        onQuickCreateCustomer={customerData.createCustomerAndReturn}
        onQuickCreateService={serviceData.createServiceAndReturn}
        onQuickCreateServiceCategory={(name) => serviceCategoryData.createCategoryAndReturn({ name, color: suggestCategoryColor(serviceCategories.map((category) => category.color)) })}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        bookingId={selectedBookingIdForPayment}
        payment={editingPayment}
        defaultAmount={paymentDefaultAmount}
        maxAmount={paymentDefaultAmount}
        onClose={closePaymentDialog}
        onCreate={(input) => createPayment(input)}
        onUpdate={(input) => updatePayment(input)}
      />

      <BookingFinancialDetailsDialog
        open={financialDetailsOpen}
        booking={selectedBookingForFinancialDetails}
        payments={payments}
        onClose={closeFinancialDetails}
        onAddPayment={(bookingId, remainingAmount) => {
          closeFinancialDetails();
          openPaymentDialog(bookingId, undefined, remainingAmount);
        }}
        onAddExpense={(bookingId) => {
          closeFinancialDetails();
          setSelectedBookingIdForExpense(bookingId);
          setExpenseDialogOpen(true);
        }}
        onUpdateAdditionalCharges={async (bookingId, charges) => {
          const succeeded = await bookingData.updateAdditionalCharges(bookingId, charges);
          if (succeeded) {
            setSelectedBookingForFinancialDetails((current) => {
              if (!current || current.id !== bookingId) return current;
              const financials = calculateBookingFinancials(
                { ...current, additionalCharges: charges },
                payments,
                expenses,
              );
              return {
                ...current,
                additionalCharges: charges,
                remainingAmount: financials.outstanding,
                estimatedProfit: financials.estimatedJobProfit,
                cashPosition: financials.cashPosition,
              };
            });
          }
          return succeeded;
        }}
      />

      <ExpenseDialog
        open={expenseDialogOpen}
        expense={null}
        bookingOptions={bookingOptions}
        categories={expenseCategories}
        onQuickCreateCategory={(name) => expenseCategoryData.createCategoryAndReturn({
          name,
          color: "#0D5C5A",
        })}
        initialValues={{
          bookingId: selectedBookingIdForExpense,
          expenseType: "Booking Expense",
        }}
        onClose={() => {
          setExpenseDialogOpen(false);
          setSelectedBookingIdForExpense(null);
        }}
        onCreate={(input) => createExpense(input)}
        onUpdate={(input) => updateExpense(input)}
      />
    </>
  );
}
