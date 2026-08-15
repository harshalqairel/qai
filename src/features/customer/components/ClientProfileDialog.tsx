"use client";

import { AtSign, CalendarPlus, FileText, MessageCircle, X } from "lucide-react";
import Link from "next/link";

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
  if (!customer) return null;
  const relatedBookings = bookings.filter((booking) => booking.customerId === customer.id).sort((a, b) => b.updatedAt - a.updatedAt);
  const bookingIds = new Set(relatedBookings.map((booking) => booking.id));
  const relatedPayments = payments.filter((payment) => bookingIds.has(payment.bookingId)).sort((a, b) => b.date.localeCompare(a.date));
  const relatedInvoices = invoices.filter((invoice) => invoice.clientId === customer.id || (invoice.bookingId ? bookingIds.has(invoice.bookingId) : false)).sort((a, b) => b.updatedAt - a.updatedAt);
  const whatsApp = whatsappUrl(customer.phone);
  const instagram = customer.instagram ? `https://instagram.com/${customer.instagram.replace(/^@/, "")}` : null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-8"><div><DialogTitle>{customer.name}</DialogTitle><DialogDescription className="mt-1">{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</DialogDescription></div><Button type="button" variant="ghost" size="icon-sm" aria-label="Close client profile" onClick={onClose}><X className="size-4" /></Button></div>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" render={<Link href={`/bookings?new=1&customer=${customer.id}`} />}><CalendarPlus className="size-4" /> Booking</Button>
          {whatsApp && <Button size="sm" variant="outline" render={<a href={whatsApp} target="_blank" rel="noreferrer" />}><MessageCircle className="size-4" /> WhatsApp</Button>}
          {instagram && <Button size="sm" variant="outline" render={<a href={instagram} target="_blank" rel="noreferrer" />}><AtSign className="size-4" /> Instagram</Button>}
          <Button size="sm" variant="outline" render={<Link href="/invoices" />}><FileText className="size-4" /> Invoice</Button>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Summary label="Bookings" value={String(customer.bookingCount)} />
          <Summary label="Total paid" value={customer.lifetimeRevenue > 0 ? formatRupiah(customer.lifetimeRevenue) : "—"} />
          <Summary label="Unpaid" value={customer.outstanding > 0 ? formatRupiah(customer.outstanding) : "—"} />
          <Summary label="Next booking" value={customer.nextBooking ?? "—"} />
        </dl>

        <div className="grid gap-5 lg:grid-cols-2">
          <ProfileSection title="Bookings" empty="No bookings yet.">
            {relatedBookings.map((booking) => <article key={booking.id} className="rounded-lg border border-border p-3 text-sm"><div className="flex justify-between gap-3"><p className="font-semibold">{services.find((service) => service.id === booking.serviceId)?.name ?? "Service"}</p><span className="text-muted-foreground">{booking.bookingStatus}</span></div><p className="mt-1 text-muted-foreground">{shortSchedule(booking)} · {formatRupiah(booking.servicePrice)}</p></article>)}
          </ProfileSection>
          <ProfileSection title="Payments" empty="No payments recorded.">
            {relatedPayments.map((payment) => <article key={payment.id} className="flex justify-between gap-3 rounded-lg border border-border p-3 text-sm"><div><p className="font-semibold">{payment.date}</p><p className="mt-1 text-muted-foreground">{payment.method}</p></div><p className="font-semibold">{formatRupiah(payment.amount)}</p></article>)}
          </ProfileSection>
          <ProfileSection title="Invoices" empty="No invoices yet.">
            {relatedInvoices.map((invoice) => <article key={invoice.id} className="flex justify-between gap-3 rounded-lg border border-border p-3 text-sm"><div><p className="font-semibold">{invoice.invoiceNumber ?? "Draft"}</p><p className="mt-1 text-muted-foreground">Version {invoice.version}</p></div><span className="text-muted-foreground">{invoice.lifecycle}</span></article>)}
          </ProfileSection>
          <section><h3 className="font-semibold">Notes</h3><p className="mt-2 min-h-20 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm text-muted-foreground">{customer.notes || "No notes."}</p></section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-muted p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-bold">{value}</dd></div>;
}

function ProfileSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return <section><h3 className="font-semibold">{title}</h3><div className="mt-2 max-h-52 space-y-2 overflow-y-auto">{items.length > 0 ? children : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{empty}</p>}</div></section>;
}
