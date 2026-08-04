"use client";

import BookingDialog from "@/features/booking/components/BookingDialog";
import PaymentDialog from "@/features/payment/components/PaymentDialog";
import CalendarHeader from "@/features/calendar/components/CalendarHeader";
import CalendarView from "@/features/calendar/components/CalendarView";
import { useCalendar } from "@/features/calendar/hooks/useCalendar";
import { BookingFormValues } from "@/features/booking/schema";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { useState } from "react";

export default function CalendarPage() {
  const {
    view,
    activeDate,
    bookingsWithNames,
    customers,
    services,
    selectedBooking,
    initialBookingValues,
    dialogOpen,
    goPrevious,
    goNext,
    goToday,
    setView,
    openCreateForDate,
    openEditBooking,
    closeDialog,
    createBooking,
    updateBooking,
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
    createBooking(input);
    closeDialog();
  };

  const handleUpdate = (input: BookingFormValues & { id: string }) => {
    updateBooking(input);
    closeDialog();
  };

  const handleDateClick = (date: string) => {
    openCreateForDate(date);
  };

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
          />

          <div className="surface-card p-3 sm:p-6">
            <CalendarView
              view={view}
              activeDate={activeDate}
              bookings={bookingsWithNames}
              onBookingClick={openEditBooking}
              onDateClick={handleDateClick}
            />
          </div>
        </div>
      </main>

      <BookingDialog
        open={dialogOpen}
        booking={selectedBooking}
        initialValues={initialBookingValues}
        customers={customers}
        services={services}
        payments={payments}
        expenses={expenses}
        onClose={closeDialog}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onAddPaymentClick={(bookingId) => openPaymentDialog(bookingId)}
        onEditPaymentClick={(payment) => openPaymentDialog(payment.bookingId, payment)}
        onDeletePayment={(id) => deletePayment(id)}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        bookingId={selectedBookingIdForPayment}
        payment={editingPayment}
        onClose={closePaymentDialog}
        onCreate={(input) => {
          createPayment(input);
          closePaymentDialog();
        }}
        onUpdate={(input) => {
          updatePayment(input);
          closePaymentDialog();
        }}
      />
    </>
  );
}
