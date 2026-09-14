"use client";

import Link from "next/link";
import { ArrowRight, CreditCard, ExternalLink } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { OperationalAttentionItem } from "@/features/attention/operationalAttention";
import MessageClientButton from "@/features/communication/components/MessageClientButton";
import type { CommunicationTemplateType } from "@/features/communication/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { bookingHref } from "@/lib/coreRecordNavigation";

type NeedsAttentionProps = {
  items: OperationalAttentionItem[];
  businessName: string;
};

function defaultTemplate(item: OperationalAttentionItem): CommunicationTemplateType {
  if (item.type === "overdue-payment") return "overdue_reminder";
  if (item.type === "payment-due-soon") return "payment_reminder";
  if (item.type === "booking-tomorrow") return "appointment_reminder";
  return "blank";
}

function tone(item: OperationalAttentionItem) {
  if (item.priority === "critical") return "bg-red-100 text-red-700";
  if (item.priority === "high") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-700";
}

export default function NeedsAttention({ items, businessName }: NeedsAttentionProps) {
  return (
    <section className="-mx-4 min-w-0 border-y border-[var(--dashboard-border)] bg-card px-4 py-5 lg:mx-0 lg:rounded-xl lg:border lg:p-6 lg:shadow-[var(--shadow-surface)]" aria-labelledby="needs-attention-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="needs-attention-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Needs attention</h2>
        <span className="text-sm font-bold tabular-nums text-[var(--dashboard-text)]">{items.length}</span>
      </div>

      {items.length === 0 ? <div className="mt-4 py-2"><p className="font-semibold text-[var(--dashboard-text)]">You’re up to date.</p><p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">No client follow-up or booking requests need action.</p></div> : <div className="mt-3 divide-y divide-[var(--dashboard-border)] border-y border-[var(--dashboard-border)]">
        {items.slice(0, 6).map((item) => {
          const requestItem = item.type === "pending-request" || item.type === "request-recovery";
          return <article key={item.id} className="py-4">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone(item)}`}>{item.priority}</span>
              <div className="min-w-0 flex-1"><p className="font-semibold text-[var(--dashboard-text)]">{item.title}</p><p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">{item.explanation}</p>{item.amount !== null && <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--dashboard-text)]">{formatRupiah(item.amount)} remaining</p>}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 pl-0 sm:pl-16">
              {item.actions.includes("message-client") && item.customerId && <MessageClientButton context={{ customerId: item.customerId, bookingId: item.bookingId, customerName: item.customerName, customerPhone: item.customerPhone, customerEmail: item.customerEmail, businessName, serviceName: item.serviceName, bookingDate: item.bookingDate, dueDate: item.dueDate, bookingValue: item.bookingValue, totalPaid: item.totalPaid, remainingAmount: item.remainingAmount, nextSessionDate: item.bookingDate }} defaultTemplate={defaultTemplate(item)} />}
              {item.actions.includes("record-payment") && item.bookingId && <Button size="sm" render={<Link href={bookingHref(item.bookingId, "payment")} />}><CreditCard className="size-4" /> Record payment</Button>}
              {item.actions.includes("open-booking") && <Button size="sm" variant="ghost" render={<Link href={item.targetHref} />}><ExternalLink className="size-4" /> Open booking</Button>}
              {item.actions.includes("review-request") && <Link href={item.targetHref} className={buttonVariants({ size: "sm", variant: item.type === "request-recovery" ? "default" : "outline" })}>Review request <ArrowRight className="size-4" /></Link>}
            </div>
            {requestItem && item.type === "request-recovery" && <p className="mt-2 text-xs font-medium text-amber-800">Retry uses the original request identity to avoid duplicate Bookings.</p>}
          </article>;
        })}
        {items.length > 6 && <p className="py-3 text-center text-xs font-medium text-[var(--dashboard-muted-text)]">{items.length - 6} more items remain in their core records.</p>}
      </div>}
    </section>
  );
}
