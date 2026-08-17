"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CustomerHeader from "@/features/customer/components/CustomerHeader";
import CustomerToolbar from "@/features/customer/components/CustomerToolbar";
import CustomerTable from "@/features/customer/components/CustomerTable";
import ClientProfileDialog from "@/features/customer/components/ClientProfileDialog";
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
import { useServices } from "@/features/service/hooks/useServices";
import { invoiceRepository } from "@/features/invoice/invoice";
import type { CustomerWithFinancials } from "@/features/customer/components/CustomerTable";

const FINANCIALLY_COMMITTED_BOOKING_STATUSES: ReadonlySet<Booking["bookingStatus"]> = new Set([
  "Scheduled",
  "Completed",
]);

export default function CustomersPage() {
  const customerData = useCustomers();
  const bookingData = useBookings();
  const paymentData = usePayments();
  const serviceData = useServices();
  const { customers, createCustomer, updateCustomer, deleteCustomer } = customerData;
  const { bookings } = bookingData;
  const { payments } = paymentData;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [profileCustomer, setProfileCustomer] = useState<CustomerWithFinancials | null>(null);
  const handledQuickCreate = useRef(false);

  useEffect(() => {
    if (handledQuickCreate.current || customerData.isLoading) return;
    handledQuickCreate.current = true;
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      const timer = window.setTimeout(() => {
        setSelectedCustomer(null);
        setDialogOpen(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [customerData.isLoading]);
  const [loadedAt] = useState(Date.now);

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
      bookingCount: number;
      nextBooking: string | null;
    }>();

    for (const booking of bookings) {
      const totals = totalsByCustomerId.get(booking.customerId) ?? {
        lifetimeRevenue: 0,
        outstanding: 0,
        bookingCount: 0,
        nextBooking: null,
      };
      const paymentSummary = paymentSummaries[booking.id];

      totals.lifetimeRevenue += paymentSummary?.totalPaid ?? 0;
      if (FINANCIALLY_COMMITTED_BOOKING_STATUSES.has(booking.bookingStatus)) {
        totals.outstanding += paymentSummary?.remainingAmount ?? booking.servicePrice;
      }
      totals.bookingCount += 1;
      const nextSession = booking.sessions
        .filter((session) => Date.parse(session.endAt) >= loadedAt)
        .sort((left, right) => left.startAt.localeCompare(right.startAt))[0];
      if (nextSession && (!totals.nextBooking || nextSession.startAt < totals.nextBooking)) totals.nextBooking = nextSession.startAt;
      totalsByCustomerId.set(booking.customerId, totals);
    }

    return totalsByCustomerId;
  }, [bookings, payments, loadedAt]);

  const customersWithFinancials = sortedCustomers.map((customer) => ({
    ...customer,
    lifetimeRevenue: customerFinancials.get(customer.id)?.lifetimeRevenue ?? 0,
    outstanding: customerFinancials.get(customer.id)?.outstanding ?? 0,
    bookingCount: customerFinancials.get(customer.id)?.bookingCount ?? 0,
    nextBooking: customerFinancials.get(customer.id)?.nextBooking
      ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(customerFinancials.get(customer.id)!.nextBooking!))
      : null,
  }));

  const isLoading = customerData.isLoading || bookingData.isLoading || paymentData.isLoading || serviceData.isLoading;
  const loadError = customerData.loadError || bookingData.loadError || paymentData.loadError || serviceData.loadError;

  if (isLoading) return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  if (loadError) return (
    <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => {
      customerData.retry();
      bookingData.retry();
      paymentData.retry();
      serviceData.retry();
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
            onView={setProfileCustomer}
          />
        </div>
      </main>

      <CustomerDialog
        open={dialogOpen}
        customer={selectedCustomer}
        customers={customers}
        onUseExisting={(customer) => setSelectedCustomer(customer)}
        onClose={() => {
          setDialogOpen(false);
          setSelectedCustomer(null);
        }}
        onCreate={(input: CreateCustomerInput) => createCustomer(input)}
        onUpdate={(input: UpdateCustomerInput) => updateCustomer(input)}
      />
      <ClientProfileDialog customer={profileCustomer} bookings={bookings} payments={payments} invoices={invoiceRepository.getAll()} services={serviceData.services} onClose={() => setProfileCustomer(null)} />
    </>
  );
}
