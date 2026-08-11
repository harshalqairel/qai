"use client";

import { useMemo, useState } from "react";
import CustomerHeader from "@/features/customer/components/CustomerHeader";
import CustomerToolbar from "@/features/customer/components/CustomerToolbar";
import CustomerTable from "@/features/customer/components/CustomerTable";
import CustomerDialog from "@/features/customer/components/CustomerDialog";

import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "@/features/customer/types";
import type { Booking } from "@/features/booking/types";
import { useCustomers } from "@/features/customer/hooks/useCustomers";
import { useBookings } from "@/features/booking/hooks/useBookings";
import { usePayments } from "@/features/payment/hooks/usePayments";
import { summarizeBookingPayments } from "@/features/payment/utils/paymentCalculations";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";

const FINANCIALLY_COMMITTED_BOOKING_STATUSES: ReadonlySet<Booking["bookingStatus"]> = new Set([
  "Scheduled",
  "Completed",
]);

export default function CustomersPage() {
  const customerData = useCustomers();
  const bookingData = useBookings();
  const paymentData = usePayments();
  const { customers, createCustomer, updateCustomer, deleteCustomer } = customerData;
  const { bookings } = bookingData;
  const { payments } = paymentData;

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

  const sortedCustomers = [...filteredCustomers];

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

  const customerFinancials = useMemo(() => {
    const paymentSummaries = summarizeBookingPayments(bookings, payments);
    const totalsByCustomerId = new Map<string, {
      lifetimeRevenue: number;
      outstanding: number;
    }>();

    for (const booking of bookings) {
      const totals = totalsByCustomerId.get(booking.customerId) ?? {
        lifetimeRevenue: 0,
        outstanding: 0,
      };
      const paymentSummary = paymentSummaries[booking.id];

      totals.lifetimeRevenue += paymentSummary?.totalPaid ?? 0;
      if (FINANCIALLY_COMMITTED_BOOKING_STATUSES.has(booking.bookingStatus)) {
        totals.outstanding += paymentSummary?.remainingAmount ?? booking.servicePrice;
      }
      totalsByCustomerId.set(booking.customerId, totals);
    }

    return totalsByCustomerId;
  }, [bookings, payments]);

  const customersWithFinancials = sortedCustomers.map((customer) => ({
    ...customer,
    lifetimeRevenue: customerFinancials.get(customer.id)?.lifetimeRevenue ?? 0,
    outstanding: customerFinancials.get(customer.id)?.outstanding ?? 0,
  }));

  const isLoading = customerData.isLoading || bookingData.isLoading || paymentData.isLoading;
  const loadError = customerData.loadError || bookingData.loadError || paymentData.loadError;

  if (isLoading) return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  if (loadError) return (
    <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => {
      customerData.retry();
      bookingData.retry();
      paymentData.retry();
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

          <CustomerTable
            customers={customersWithFinancials}
            onAdd={() => {
              setSelectedCustomer(null);
              setDialogOpen(true);
            }}
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
