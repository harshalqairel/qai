"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type NeedsAttentionProps = {
  overdueCount: number;
  overdueAmount: number;
  requestCount: number;
};

export default function NeedsAttention({ overdueCount, overdueAmount, requestCount }: NeedsAttentionProps) {
  const attentionCount = overdueCount + requestCount;
  return (
    <section className="-mx-4 min-w-0 border-y border-[var(--dashboard-border)] bg-card px-4 py-5 lg:mx-0 lg:rounded-xl lg:border lg:p-6 lg:shadow-[var(--shadow-surface)]" aria-labelledby="needs-attention-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="needs-attention-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Needs attention</h2>
        <span className="text-sm font-bold tabular-nums text-[var(--dashboard-text)]">{attentionCount}</span>
      </div>

      {attentionCount === 0 ? <div className="mt-4 py-2"><p className="font-semibold text-[var(--dashboard-text)]">You’re up to date.</p><p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">No overdue payments or booking requests need action.</p></div> : <div className="mt-3 divide-y divide-[var(--dashboard-border)] border-y border-[var(--dashboard-border)]">
        {overdueCount > 0 && <Link href="/bookings?payment=outstanding" className="flex min-h-17 items-center gap-3 py-3">
          <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--dashboard-text)]">Overdue payments</span><span className="mt-1 block text-sm text-[var(--dashboard-muted-text)]">{overdueCount} {overdueCount === 1 ? "booking" : "bookings"} · {formatRupiah(overdueAmount)}</span></span>
          <ChevronRight className="size-5 shrink-0 text-[var(--dashboard-muted-text)]" aria-hidden="true" />
        </Link>}
        {requestCount > 0 && <Link href="/qai-page?tab=Requests" className="flex min-h-17 items-center gap-3 py-3">
          <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--dashboard-text)]">Booking requests</span><span className="mt-1 block text-sm text-[var(--dashboard-muted-text)]">{requestCount} waiting</span></span>
          <ChevronRight className="size-5 shrink-0 text-[var(--dashboard-muted-text)]" aria-hidden="true" />
        </Link>}
      </div>}
    </section>
  );
}
