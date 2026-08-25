"use client";

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { bulkServiceChangeEligibility } from "@/features/booking/domain/serviceChange";
import type { Booking } from "@/features/booking/types";
import type { Invoice } from "@/features/invoice/invoice";
import type { Service } from "@/features/service/types";

export type BulkServiceNamedBooking = Booking & { customerName: string; serviceName: string };

export default function BulkServiceChangeDialog({
  open,
  bookings,
  services,
  invoices,
  onClose,
  onApply,
}: {
  open: boolean;
  bookings: BulkServiceNamedBooking[];
  services: Service[];
  invoices: Invoice[];
  onClose: () => void;
  onApply: (service: Service, eligible: BulkServiceNamedBooking[], skipped: Array<{ booking: BulkServiceNamedBooking; reason: string }>) => void | Promise<void>;
}) {
  const [serviceId, setServiceId] = useState("");
  const [pending, setPending] = useState(false);
  const service = services.find((item) => item.id === serviceId) ?? null;
  const plan = useMemo(() => {
    if (!service) return { eligible: [] as BulkServiceNamedBooking[], skipped: [] as Array<{ booking: BulkServiceNamedBooking; reason: string }> };
    return bookings.reduce((result, booking) => {
      const eligibility = bulkServiceChangeEligibility(booking, service, invoices);
      if (eligibility.eligible) result.eligible.push(booking);
      else result.skipped.push({ booking, reason: eligibility.message ?? "Needs individual review." });
      return result;
    }, { eligible: [] as BulkServiceNamedBooking[], skipped: [] as Array<{ booking: BulkServiceNamedBooking; reason: string }> });
  }, [bookings, invoices, service]);

  function close() {
    if (pending) return;
    setServiceId("");
    onClose();
  }

  async function apply() {
    if (!service || plan.eligible.length === 0) return;
    setPending(true);
    await onApply(service, plan.eligible, plan.skipped);
    setPending(false);
    setServiceId("");
  }

  const serviceItems = services.filter((item) => item.active).map((item) => ({
    value: item.id,
    label: item.name,
    description: item.availability?.mode && item.availability.mode !== "Flexible" ? "Managed booking times" : "Flexible scheduling",
    keywords: item.description,
  }));

  return <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Change service for {bookings.length} {bookings.length === 1 ? "booking" : "bookings"}</DialogTitle><DialogDescription>Existing amounts, schedules, payments, expenses, additional charges, and invoices are preserved.</DialogDescription></DialogHeader><div className="space-y-4"><div><p className="mb-2 text-sm font-semibold">New service</p><SearchableSelect label="New service" value={serviceId} onValueChange={setServiceId} items={serviceItems} placeholder="Choose a service" searchPlaceholder="Search services…" clearable={false} /></div>{service && <div className="rounded-xl border border-border bg-muted/35 p-4 text-sm"><div className="flex items-center gap-2 font-semibold"><span>{bookings.length} selected</span><ArrowRight className="size-4 text-muted-foreground" /><span>{plan.eligible.length} ready</span></div>{plan.skipped.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="font-semibold text-amber-800">{plan.skipped.length} {plan.skipped.length === 1 ? "booking needs" : "bookings need"} individual review</p><ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">{plan.skipped.slice(0, 4).map(({ booking, reason }) => <li key={booking.id}><span className="font-medium text-foreground">{booking.customerName}</span> — {reason}</li>)}</ul>{plan.skipped.length > 4 && <p className="mt-1 text-xs text-muted-foreground">+{plan.skipped.length - 4} more</p>}</div>}</div>}</div><DialogFooter><Button type="button" variant="outline" onClick={close} disabled={pending}>Cancel</Button><Button type="button" onClick={() => void apply()} disabled={!service || plan.eligible.length === 0 || pending}>{pending ? "Changing…" : `Change ${plan.eligible.length || ""} ${plan.eligible.length === 1 ? "booking" : "bookings"}`}</Button></DialogFooter></DialogContent></Dialog>;
}
