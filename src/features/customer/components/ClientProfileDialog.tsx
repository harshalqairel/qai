"use client";

import { AtSign, CalendarPlus, FileText, MessageCircle, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Booking } from "@/features/booking/types";
import type { Invoice } from "@/features/invoice/invoice";
import type { Payment } from "@/features/payment/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import type { Service } from "@/features/service/types";
import type { CustomerWithFinancials } from "./CustomerTable";

type ClientProfileDialogProps = {
  customer: CustomerWithFinancials | null;
  bookings: Booking[];
  payments: Payment[];
  invoices: Invoice[];
  services: Service[];
  onClose: () => void;
};

function whatsappUrl(phone: string) {
  const normalized = phone.replace(/\D/g, "");
  return /^[1-9]\d{7,14}$/.test(normalized) ? `https://wa.me/${normalized}` : null;
}

function shortSchedule(booking: Booking) {
  const first = [...booking.sessions].sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
  return first ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(first.startAt)) : "—";
}

export default function ClientProfileDialog({ customer, bookings, payments, invoices, services, onClose }: ClientProfileDialogProps) {
  const [tab, setTab] = useState<"Overview" | "Bookings" | "Payments" | "Invoices" | "Notes">("Overview");
  if (!customer) return null;
  const relatedBookings = bookings.filter((booking) => booking.customerId === customer.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const bookingIds = new Set(relatedBookings.map((booking) => booking.id));
  const relatedPayments = payments.filter((payment) => bookingIds.has(payment.bookingId)).sort((a, b) => b.date.localeCompare(a.date));
  const relatedInvoices = invoices.filter((invoice) => invoice.clientId === customer.id || (invoice.bookingId ? bookingIds.has(invoice.bookingId) : false)).sort((a, b) => b.updatedAt - a.updatedAt);
  const whatsApp = whatsappUrl(customer.phone);
  const instagram = customer.instagram ? `https://instagram.com/${customer.instagram.replace(/^@/, "")}` : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false} className="h-[calc(100dvh-.5rem)] max-h-[calc(100dvh-.5rem)] max-w-[calc(100%-1rem)] gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-4xl">
        <DialogHeader className="border-b border-border bg-[linear-gradient(135deg,var(--surface),var(--surface-subtle))] px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="section-kicker">Client profile</p><DialogTitle className="mt-1 truncate text-2xl sm:text-3xl">{customer.name}</DialogTitle><DialogDescription className="mt-2 break-words">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}{customer.instagram ? ` · @${customer.instagram.replace(/^@/, "")}` : ""}</DialogDescription></div><Button type="button" variant="ghost" size="icon" aria-label="Close client profile" onClick={onClose}><X className="size-5" /></Button></div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" render={<Link href={`/bookings?new=1&customer=${customer.id}`} />}><CalendarPlus className="size-4" /> New booking</Button>
            {whatsApp && <Button size="sm" variant="outline" render={<a href={whatsApp} target="_blank" rel="noreferrer" />}><MessageCircle className="size-4" /> WhatsApp</Button>}
            {instagram && <Button size="sm" variant="outline" render={<a href={instagram} target="_blank" rel="noreferrer" />}><AtSign className="size-4" /> Instagram</Button>}
            <Button size="sm" variant="outline" render={<Link href="/invoices?new=1" />}><FileText className="size-4" /> Invoice</Button>
          </div>
        </DialogHeader>

        <dl className="grid grid-cols-2 divide-x divide-y divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
          <Summary label="Bookings" value={String(customer.bookingCount)} />
          <Summary label="Total paid" value={customer.lifetimeRevenue > 0 ? formatRupiah(customer.lifetimeRevenue) : "—"} />
          <Summary label="Unpaid" value={customer.outstanding > 0 ? formatRupiah(customer.outstanding) : "—"} />
          <Summary label="Next booking" value={customer.nextBooking ?? "—"} />
        </dl>

        <nav className="grid shrink-0 grid-cols-5 gap-1 border-b border-border px-3 py-2 sm:flex sm:px-6" aria-label="Client profile sections">
          {(["Overview", "Bookings", "Payments", "Invoices", "Notes"] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`min-h-10 min-w-0 rounded-lg px-1 text-xs font-semibold sm:shrink-0 sm:px-3 sm:text-sm ${tab === item ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>{item}</button>)}
        </nav>

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {tab === "Overview" && <div className="grid gap-6 lg:grid-cols-2"><ProfileSection title="Recent bookings" empty="No bookings yet.">{relatedBookings.slice(0, 4).map((booking) => <BookingRow key={booking.id} booking={booking} serviceName={services.find((service) => service.id === booking.serviceId)?.name ?? "Service"} />)}</ProfileSection><ProfileSection title="Recent payments" empty="No payments recorded.">{relatedPayments.slice(0, 4).map((payment) => <PaymentRow key={payment.id} payment={payment} />)}</ProfileSection></div>}
          {tab === "Bookings" && <ProfileSection title="Bookings" empty="No bookings yet.">{relatedBookings.map((booking) => <BookingRow key={booking.id} booking={booking} serviceName={services.find((service) => service.id === booking.serviceId)?.name ?? "Service"} />)}</ProfileSection>}
          {tab === "Payments" && <ProfileSection title="Payments" empty="No payments recorded.">{relatedPayments.map((payment) => <PaymentRow key={payment.id} payment={payment} />)}</ProfileSection>}
          {tab === "Invoices" && <ProfileSection title="Invoices" empty="No invoices yet.">{relatedInvoices.map((invoice) => <article key={invoice.id} className="flex justify-between gap-3 border-b border-border py-3 text-sm last:border-b-0"><div><p className="font-semibold">{invoice.invoiceNumber ?? "Draft"}</p><p className="mt-1 text-muted-foreground">Version {invoice.version}</p></div><span className="text-muted-foreground">{invoice.lifecycle}</span></article>)}</ProfileSection>}
          {tab === "Notes" && <section><h3 className="font-semibold">Notes</h3><p className="mt-3 min-h-32 whitespace-pre-wrap rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">{customer.notes || "No notes."}</p></section>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-4 py-3 sm:px-5 sm:py-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-bold">{value}</dd></div>;
}

function ProfileSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return <section><h3 className="font-semibold">{title}</h3><div className="mt-2">{items.length > 0 ? children : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{empty}</p>}</div></section>;
}

function BookingRow({ booking, serviceName }: { booking: Booking; serviceName: string }) {
  return <article className="flex items-start justify-between gap-4 border-b border-border py-3 text-sm last:border-b-0"><div className="min-w-0"><p className="truncate font-semibold">{serviceName}</p><p className="mt-1 text-muted-foreground">{shortSchedule(booking)} · {formatRupiah(booking.servicePrice)}</p></div><span className="shrink-0 text-xs font-semibold text-muted-foreground">{booking.bookingStatus}</span></article>;
}

function PaymentRow({ payment }: { payment: Payment }) {
  return <article className="flex items-start justify-between gap-4 border-b border-border py-3 text-sm last:border-b-0"><div><p className="font-semibold">{payment.date}</p><p className="mt-1 text-muted-foreground">{payment.method}</p></div><p className="font-semibold tabular-nums">{formatRupiah(payment.amount)}</p></article>;
}
