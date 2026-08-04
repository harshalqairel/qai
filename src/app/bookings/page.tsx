"use client";

import { useMemo, useState } from "react";
import BookingHeader from "@/features/booking/components/BookingHeader";
import BookingToolbar from "@/features/booking/components/BookingToolbar";
import BookingList from "@/features/booking/components/BookingList";
import BookingDialog from "@/features/booking/components/BookingDialog";
import PaymentDialog from "@/features/payment/components/PaymentDialog";
import { Booking, CreateBookingInput, UpdateBookingInput } from "@/features/booking/types";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useServices } from "@/features/service/hooks/useServices";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { Payment } from "@/features/payment/types";
import { useExpenses } from "@/features/expense/hooks/useExpenses";
import { summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";

type BookingWithNames = Booking & {
  customerName: string;
  serviceName: string;
  paymentStatus: "Outstanding" | "Partial Paid" | "Fully Paid" | "Cancelled";
  totalPaid: number;
  remainingAmount: number;
};

export default function BookingsPage() {
  const bookingData = useBookings();
  const customerData = useCustomers();
  const serviceData = useServices();
  const paymentData = usePayments();
  const expenseData = useExpenses();
  const { bookings, createBooking, updateBooking, deleteBooking } = bookingData;
  const { customers } = customerData;
  const { services } = serviceData;
  const { payments, createPayment, updatePayment, deletePayment } = paymentData;
  const { expenses } = expenseData;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedBookingIdForPayment, setSelectedBookingIdForPayment] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");

  const paymentSummaries = useMemo(() => summarizeBookingPayments(bookings, payments), [bookings, payments]);
  const keyword = search.trim().toLowerCase();

  const bookingsWithNames: BookingWithNames[] = bookings.map((booking) => {
    const customer = customers.find((item) => item.id === booking.customerId);
    const service = services.find((item) => item.id === booking.serviceId);
    const effectiveServicePrice = booking.servicePrice > 0 ? booking.servicePrice : service?.price ?? 0;
    const paymentSummary = paymentSummaries[booking.id];

    return {
      ...booking,
      servicePrice: effectiveServicePrice,
      customerName: customer?.name ?? "Unknown Customer",
      serviceName: service?.name ?? "Unknown Service",
      paymentStatus: paymentSummary?.paymentStatus ?? "Outstanding",
      totalPaid: paymentSummary?.totalPaid ?? 0,
      remainingAmount: paymentSummary?.remainingAmount ?? effectiveServicePrice,
    };
  });

  const filteredBookings = bookingsWithNames.filter((booking) => {
    const matchesSearch =
      keyword === "" ||
      booking.customerName.toLowerCase().includes(keyword) ||
      booking.serviceName.toLowerCase().includes(keyword) ||
      booking.location.toLowerCase().includes(keyword) ||
      booking.notes.toLowerCase().includes(keyword);

    const matchesBookingStatus = statusFilter === "" || booking.bookingStatus === statusFilter;
    const matchesPaymentStatus = paymentStatusFilter === "" || booking.paymentStatus === paymentStatusFilter;
    return matchesSearch && matchesBookingStatus && matchesPaymentStatus;
  });

  const sortedBookings = [...filteredBookings];
  switch (sort) {
    case "date-asc":
      sortedBookings.sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
      break;
    case "date-desc":
      sortedBookings.sort((a, b) => b.bookingDate.localeCompare(a.bookingDate));
      break;
    case "oldest":
      sortedBookings.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "newest":
    default:
      sortedBookings.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  function openPaymentDialog(bookingId: string, payment?: Payment) {
    setSelectedBookingIdForPayment(bookingId);
    setEditingPayment(payment ?? null);
    setPaymentDialogOpen(true);
  }

  function closePaymentDialog() {
    setPaymentDialogOpen(false);
    setSelectedBookingIdForPayment(null);
    setEditingPayment(null);
  }

  const dataSources = [bookingData, customerData, serviceData, paymentData, expenseData];
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

          <BookingList
            bookings={sortedBookings}
            onEdit={(booking) => {
              setSelectedBooking(booking);
              setDialogOpen(true);
            }}
            onDelete={(booking) => deleteBooking(booking.id)}
          />
        </div>
      </main>

      <BookingDialog
        open={dialogOpen}
        booking={selectedBooking}
        customers={customers}
        services={services}
        payments={payments}
        expenses={expenses}
        onClose={() => {
          setDialogOpen(false);
          setSelectedBooking(null);
        }}
        onCreate={(input: CreateBookingInput) => createBooking(input)}
        onUpdate={(input: UpdateBookingInput) => updateBooking(input)}
        onAddPaymentClick={(bookingId) => openPaymentDialog(bookingId)}
        onEditPaymentClick={(payment) => openPaymentDialog(payment.bookingId, payment)}
        onDeletePayment={(id) => deletePayment(id)}
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
