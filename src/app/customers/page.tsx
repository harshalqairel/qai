"use client";

import { useState } from "react";

import CustomerHeader from "@/features/customer/components/CustomerHeader";
import CustomerToolbar from "@/features/customer/components/CustomerToolbar";
import CustomerList from "@/features/customer/components/CustomerList";
import CustomerDialog from "@/features/customer/components/CustomerDialog";

import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/features/customer/types";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import { useMemo } from "react";
import { useServices } from "@/features/service/hooks/useServices";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";

export default function CustomersPage() {
  const customerData = useCustomers();
  const bookingData = useBookings();
  const paymentData = usePayments();
  const serviceData = useServices();
  const { customers, createCustomer, updateCustomer, deleteCustomer } = customerData;
  const { bookings } = bookingData;
  const { payments } = paymentData;
  const { services } = serviceData;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");

  const keyword = search.trim().toLowerCase();

  const filteredCustomers = customers.filter((customer) => {
    return (
      keyword === "" ||
      customer.name.toLowerCase().includes(keyword) ||
      customer.phone.toLowerCase().includes(keyword) ||
      customer.instagram.toLowerCase().includes(keyword) ||
      customer.email.toLowerCase().includes(keyword) ||
      customer.notes.toLowerCase().includes(keyword)
    );
  });

  const paymentSummaries = useMemo(() => summarizeBookingPayments(bookings, payments), [bookings, payments]);

  const customersWithStats = filteredCustomers.map((customer) => {
    const customerBookings = bookings.filter((booking) => booking.customerId === customer.id);
    const lifetimeRevenue = customerBookings.reduce((sum, booking) => {
      const summary = paymentSummaries[booking.id];
      return sum + (summary?.totalPaid ?? 0);
    }, 0);

    const outstandingBalance = customerBookings.reduce((sum, booking) => {
      if (booking.bookingStatus === "Cancelled") return sum;
      const summary = paymentSummaries[booking.id];
      const service = services.find((item) => item.id === booking.serviceId);
      const effectivePrice = booking.servicePrice > 0 ? booking.servicePrice : service?.price ?? 0;
      return sum + (summary?.remainingAmount ?? effectivePrice);
    }, 0);

    const upcoming = customerBookings
      .filter((booking) => booking.bookingStatus !== "Cancelled" && new Date(`${booking.bookingDate}T00:00:00`) >= new Date())
      .sort((a, b) => a.bookingDate.localeCompare(b.bookingDate))[0];

    return {
      ...customer,
      bookingsCount: customerBookings.length,
      lifetimeRevenue,
      outstandingBalance,
      upcomingBooking: upcoming ? `${upcoming.bookingDate} ${upcoming.startTime}` : null,
    };
  });

  const sortedCustomers = [...customersWithStats];

  switch (sort) {
    case "name-asc":
      sortedCustomers.sort((a, b) => a.name.localeCompare(b.name));
      break;

    case "name-desc":
      sortedCustomers.sort((a, b) => b.name.localeCompare(a.name));
      break;

    case "oldest":
      sortedCustomers.sort((a, b) => a.createdAt - b.createdAt);
      break;

    case "newest":
    default:
      sortedCustomers.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  const isLoading = customerData.isLoading || bookingData.isLoading || paymentData.isLoading || serviceData.isLoading;
  const loadError = customerData.loadError || bookingData.loadError || paymentData.loadError || serviceData.loadError;

  if (isLoading) return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  if (loadError) return (
    <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => {
      customerData.retry(); bookingData.retry(); paymentData.retry(); serviceData.retry();
    }} /></div></main>
  );

  return (
    <>
      <main className="min-h-screen">
        <div className="page-shell">

          <CustomerHeader
            onAdd={() => {
              setSelectedCustomer(null);
              setDialogOpen(true);
            }}
          />

          <CustomerToolbar
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
          />

          <CustomerList
            customers={sortedCustomers}
            onEdit={(customer) => {
              setSelectedCustomer(customer);
              setDialogOpen(true);
            }}
            onDelete={(customer) => deleteCustomer(customer.id)}
          />
        </div>
      </main>

      <CustomerDialog
        open={dialogOpen}
        customer={selectedCustomer}
        onClose={() => {
          setDialogOpen(false);
          setSelectedCustomer(null);
        }}
        onCreate={(input: CreateCustomerInput) => createCustomer(input)}
        onUpdate={(input: UpdateCustomerInput) => updateCustomer(input)}
      />
    </>
  );
}
