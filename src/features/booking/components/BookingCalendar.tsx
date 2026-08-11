"use client";

import BookingDialog from "@/features/booking/components/BookingDialog";
import { BookingFormValues } from "@/features/booking/schema";
import CalendarHeader from "@/features/calendar/components/CalendarHeader";
import CalendarView from "@/features/calendar/components/CalendarView";
import { useCalendar } from "@/features/calendar/hooks/useCalendar";
import PaymentDialog from "@/features/payment/components/PaymentDialog";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { useState } from "react";

export default function BookingCalendar() {
  const {
    view,
    activeDate,
    bookingsWithNames,
    customers,
    services,
    serviceCategories,
    createCustomerAndReturn,
    createServiceAndReturn,
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
    timezone,
    todayKey,
  } = useCalendar();

  const { payments, createPayment, updatePayment, deletePayment } = usePayments();
  const { expenses } = useExpenses();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBookingIdForPayment, setSelectedBookingIdForPayment] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<import("@/features/payment/types").Payment | null>(null);

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

  const handleCreate = (input: BookingFormValues) => {
    return createBooking(input);
  };

  const handleUpdate = (input: BookingFormValues & { id: string }) => {
    return updateBooking(input);
  };

  return (
    <>
      <div className="space-y-6">
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
        <div className="rounded-xl border border-border bg-white p-3 shadow-sm sm:p-6">
          <CalendarView
            view={view}
            activeDate={activeDate}
            bookings={bookingsWithNames}
            onBookingClick={openEditBooking}
            onDateClick={openCreateForDate}
            onSelectDate={selectDate}
            todayKey={todayKey}
          />
        </div>
      </div>

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
