"use client";

import BookingDialog from "@/features/booking/components/BookingDialog";
import PaymentDialog from "@/features/payment/components/PaymentDialog";
import CalendarHeader from "@/features/calendar/components/CalendarHeader";
import CalendarView from "@/features/calendar/components/CalendarView";
import { useCalendar } from "@/features/calendar/hooks/useCalendar";
import { BookingFormValues } from "@/features/booking/schema";
import type { CreateBookingCommand } from "@/features/booking/types";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { useState } from "react";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";
import GoogleCalendarSyncCard from "@/features/calendar/components/GoogleCalendarSyncCard";

export default function CalendarPage() {
  const {
    view,
    activeDate,
    bookingsWithNames,
    customers,
    services,
    serviceCategories,
    createCustomerAndReturn,
    createServiceAndReturn,
    createServiceCategoryAndReturn,
    selectedBooking,
    initialBookingValues,
    dialogOpen,
    goPrevious,
    goNext,
    goToday,
    goPreviousMonth,
    goNextMonth,
    selectDate,
    setView,
    openCreateForDate,
    openEditBooking,
    closeDialog,
    createBooking,
    updateBooking,
    isLoading: calendarLoading,
    loadError: calendarError,
    retry: retryCalendar,
    timezone,
    todayKey,
  } = useCalendar();
  const paymentData = usePayments();
  const expenseData = useExpenses();
  const { payments, createPayment, updatePayment, deletePayment } = paymentData;
  const { expenses } = expenseData;
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBookingIdForPayment, setSelectedBookingIdForPayment] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<import("@/features/payment/types").Payment | null>(null);
  const monthSessions = bookingsWithNames.filter((booking) => {
    const date = new Date(`${booking.bookingDate}T00:00:00`);
    return date.getFullYear() === activeDate.getFullYear() && date.getMonth() === activeDate.getMonth();
  });

  function openPaymentDialog(bookingId: string, payment?: import("@/features/payment/types").Payment) {
    setSelectedBookingIdForPayment(bookingId);
    setEditingPayment(payment ?? null);
    setPaymentDialogOpen(true);
  }

  function closePaymentDialog() {
    setPaymentDialogOpen(false);
    setSelectedBookingIdForPayment(null);
    setEditingPayment(null);
  }

  const handleCreate = async (command: CreateBookingCommand) => {
    const created = await createBooking(command);
    if (created) await paymentData.retry();
    return created;
  };

  const handleUpdate = (input: BookingFormValues & { id: string }) => {
    return updateBooking(input);
  };

  const handleDateClick = (date: string) => {
    openCreateForDate(date);
  };

  if (calendarLoading || paymentData.isLoading || expenseData.isLoading) return <main className="min-h-screen"><PageSkeleton variant="calendar" /></main>;
  if (calendarError || paymentData.loadError || expenseData.loadError) return (
    <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => { retryCalendar(); paymentData.retry(); expenseData.retry(); }} /></div></main>
  );

  return (
    <>
      <main className="min-h-screen">
        <div className="page-shell">
          <CalendarHeader
            view={view}
            activeDate={activeDate}
            onViewChange={setView}
            onPrevious={goPrevious}
            onNext={goNext}
            onToday={goToday}
            onPreviousMonth={goPreviousMonth}
            onNextMonth={goNextMonth}
          />

          <section aria-label="Calendar summary" className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <CalendarMetric label="This month" value={monthSessions.length} />
            <CalendarMetric label="Today" value={bookingsWithNames.filter((booking) => booking.bookingDate === todayKey).length} />
            <CalendarMetric label="Scheduled" value={monthSessions.filter((booking) => booking.bookingStatus === "Scheduled").length} />
          </section>

          <div className="min-w-0">
            <CalendarView
              view={view}
              activeDate={activeDate}
              bookings={bookingsWithNames}
              onBookingClick={openEditBooking}
              onDateClick={handleDateClick}
              onSelectDate={selectDate}
              todayKey={todayKey}
            />
          </div>

          <GoogleCalendarSyncCard />
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
        timezone={timezone}
        onClose={closeDialog}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onAddPaymentClick={(bookingId) => openPaymentDialog(bookingId)}
        onEditPaymentClick={(payment) => openPaymentDialog(payment.bookingId, payment)}
        onDeletePayment={(id) => deletePayment(id)}
        onQuickCreateCustomer={createCustomerAndReturn}
        onQuickCreateService={createServiceAndReturn}
        onQuickCreateServiceCategory={createServiceCategoryAndReturn}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        bookingId={selectedBookingIdForPayment}
        payment={editingPayment}
        onClose={closePaymentDialog}
        onCreate={(input) => createPayment(input)}
        onUpdate={(input) => updatePayment(input)}
      />
    </>
  );
}

function CalendarMetric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-0 px-3 py-3 text-center sm:px-5 sm:py-4"><p className="truncate text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p></div>;
}
