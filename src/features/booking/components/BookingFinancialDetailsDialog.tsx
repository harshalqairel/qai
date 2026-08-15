"use client";

import { Plus, Trash2, XIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import type { Booking, BookingAdditionalCharge } from "@/features/booking/types";
import type { Payment, DerivedPaymentStatus } from "@/features/payment/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import ReminderHistoryList from "@/features/reminder/components/ReminderHistoryList";
import { invoiceRepository, latestInvoiceVersions } from "@/features/invoice/invoice";
import { bookingAdditionalChargesTotal, bookingClientTotal } from "@/features/booking/domain/bookingFinancials";
import { createAdditionalChargeCategoryPersistent, getAdditionalChargeCategories, loadAdditionalChargeCategories, type AdditionalChargeCategory } from "@/features/booking/domain/additionalChargeCategories";
import { notify } from "@/lib/notifications";

export type BookingFinancialDetails = Booking & {
  customerName: string;
  serviceName: string;
  paymentStatus: DerivedPaymentStatus;
  totalPaid: number;
  remainingAmount: number | null;
  directExpenses: number;
  estimatedProfit: number | null;
  cashPosition: number | null;
};

type BookingFinancialDetailsDialogProps = {
  open: boolean;
  booking: BookingFinancialDetails | null;
  payments: Payment[];
  onClose: () => void;
  onAddPayment: (bookingId: string, remainingAmount: number) => void;
  onAddExpense: (bookingId: string) => void;
  onUpdateAdditionalCharges: (bookingId: string, charges: BookingAdditionalCharge[]) => Promise<boolean>;
};

function isPaymentAllowed(booking: BookingFinancialDetails): boolean {
  return booking.bookingStatus !== "Cancelled" && (booking.remainingAmount ?? 0) > 0;
}

function paymentStatusLabel(status: DerivedPaymentStatus): string {
  if (status === "Outstanding") return "Unpaid";
  if (status === "Partial Paid") return "Part paid";
  if (status === "Fully Paid") return "Paid";
  return "Cancelled";
}

function valueClass(value: number): string {
  return value < 0 ? "text-destructive" : "text-foreground";
}

export default function BookingFinancialDetailsDialog({
  open,
  booking,
  payments,
  onClose,
  onAddPayment,
  onAddExpense,
  onUpdateAdditionalCharges,
}: BookingFinancialDetailsDialogProps) {
  const [categories, setCategories] = useState<AdditionalChargeCategory[]>(getAdditionalChargeCategories);
  const [addingCharge, setAddingCharge] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState(() => getAdditionalChargeCategories()[0]?.id ?? "");
  const [sessionId, setSessionId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadAdditionalChargeCategories().then((loaded) => {
      if (!active) return;
      setCategories(loaded);
      setCategoryId((current) => loaded.some((item) => item.id === current) ? current : loaded[0]?.id ?? "");
    }).catch(() => notify.error("Could not load additional charge categories."));
    return () => { active = false; };
  }, [open]);

  if (!open || !booking) {
    return null;
  }
  const activeBooking = booking;

  const bookingPayments = payments
    .filter((payment) => payment.bookingId === booking.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const canAddPayment = isPaymentAllowed(booking);
  const canAddExpense = booking.bookingStatus !== "Cancelled";
  const isCancelled = booking.bookingStatus === "Cancelled";
  const relatedInvoice = latestInvoiceVersions(invoiceRepository.getAll().filter((invoice) => invoice.bookingId === booking.id))[0] ?? null;
  const charges = booking.additionalCharges ?? [];
  const chargesTotal = bookingAdditionalChargesTotal(booking);

  async function addCharge() {
    const category = categories.find((item) => item.id === categoryId);
    if (!category || amount <= 0) return notify.error("Choose a category and enter an amount.");
    const now = Date.now();
    const next = [...charges, { id: crypto.randomUUID(), bookingId: activeBooking.id, sessionId: sessionId || null, categoryId: category.id, categoryName: category.name, description: description.trim(), amount, createdAt: now, updatedAt: now }];
    if (!await onUpdateAdditionalCharges(activeBooking.id, next)) return notify.error("Could not add the charge.");
    setAmount(0); setDescription(""); setSessionId(""); setAddingCharge(false); notify.success("Additional charge added.");
  }

  async function removeCharge(id: string) {
    if (!window.confirm("Delete this additional charge?")) return;
    if (!await onUpdateAdditionalCharges(activeBooking.id, charges.filter((charge) => charge.id !== id))) return notify.error("Could not delete the charge.");
    notify.success("Additional charge deleted.");
  }

  async function addCategory() {
    try { const created = await createAdditionalChargeCategoryPersistent(newCategoryName); const loaded = await loadAdditionalChargeCategories(); setCategories(loaded); setCategoryId(created.id); setNewCategoryName(""); setNewCategoryOpen(false); }
    catch (error) { notify.error(error instanceof Error && error.message === "DUPLICATE_CATEGORY" ? "A charge category with this name already exists." : "Enter a category name."); }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        aria-label={`Financial details for ${booking.customerName}`}
        className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h2 className="dialog-title">Payment Details</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {booking.customerName} · {booking.serviceName}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close payment details">
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <section className="rounded-xl border border-border bg-muted/30 p-4" aria-label="Booking financial summary">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Booking Status</p>
              <p className="mt-1 font-semibold">{booking.bookingStatus}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Client Total</p>
              <p className="mt-1 font-semibold">{formatRupiah(bookingClientTotal(booking))}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {isCancelled ? "Payments Recorded" : "Total Paid"}
              </p>
              <p className="mt-1 font-semibold">{formatRupiah(booking.totalPaid)}</p>
            </div>
            {!isCancelled && (
              <div>
                <p className="text-muted-foreground">Remaining</p>
                <p className="mt-1 font-semibold">{formatRupiah(booking.remainingAmount ?? 0)}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Payment Status</p>
              <p className="mt-1 font-semibold">{paymentStatusLabel(booking.paymentStatus)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Direct Expenses</p>
              <p className="mt-1 font-semibold">{formatRupiah(booking.directExpenses)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Est. Job Profit</p>
              <p className={`mt-1 font-semibold ${booking.estimatedProfit === null ? "" : valueClass(booking.estimatedProfit)}`}>
                {booking.estimatedProfit === null ? "Not applicable" : formatRupiah(booking.estimatedProfit)}
              </p>
            </div>
            {!isCancelled && (
              <div>
                <p className="text-muted-foreground">Cash Position</p>
                <p className={`mt-1 font-semibold ${valueClass(booking.cashPosition ?? 0)}`}>
                  {formatRupiah(booking.cashPosition ?? 0)}
                </p>
              </div>
            )}
          </div>
          {isCancelled && (
            <p className="mt-4 text-sm text-muted-foreground">
              Cancelled bookings are excluded from profit and outstanding totals.
            </p>
          )}
        </section>

        <section className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-semibold">Payment History</h3>
            {canAddPayment && (
              <Button
                type="button"
                size="sm"
                onClick={() => onAddPayment(booking.id, booking.remainingAmount ?? 0)}
              >
                Add Payment
              </Button>
            )}
          </div>
          {bookingPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {bookingPayments.map((payment) => (
                <article key={payment.id} className="rounded-xl border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{payment.date}</p>
                    <p className="font-semibold">{formatRupiah(payment.amount)}</p>
                  </div>
                  <p className="mt-1 text-muted-foreground">{payment.method}</p>
                  {payment.notes && <p className="mt-1 text-muted-foreground">{payment.notes}</p>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 border-t border-border pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Additional Charges</h3><p className="mt-1 text-sm text-muted-foreground">Client-facing charges stay separate from business Expenses.</p></div><Button size="sm" variant="outline" disabled={isCancelled} onClick={() => setAddingCharge((value) => !value)}><Plus className="size-4" /> Add charge</Button></div>
          {charges.length > 0 && <div className="mt-4 space-y-2">{charges.map((charge) => { const session = charge.sessionId ? booking.sessions.find((item) => item.id === charge.sessionId) : null; return <article key={charge.id} className="flex items-start gap-3 rounded-xl border border-border p-3"><div className="min-w-0 flex-1"><p className="font-semibold">{charge.categoryName}</p><p className="mt-1 text-sm text-muted-foreground">{session ? `Schedule ${session.sequence}${session.label ? ` · ${session.label}` : ""}` : "Overall booking"}{charge.description ? ` · ${charge.description}` : ""}</p></div><p className="shrink-0 font-semibold">{formatRupiah(charge.amount)}</p><Button size="icon-sm" variant="ghost" aria-label={`Delete ${charge.categoryName} charge`} onClick={() => void removeCharge(charge.id)}><Trash2 className="size-4" /></Button></article>; })}<div className="flex justify-between px-1 text-sm font-bold"><span>Charges total</span><span>{formatRupiah(chargesTotal)}</span></div></div>}
          {addingCharge && <div className="mt-4 space-y-4 rounded-xl bg-muted/50 p-4"><div><Label>Category</Label><select className="native-control mt-2" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Button className="mt-2" size="sm" variant="ghost" onClick={() => setNewCategoryOpen((value) => !value)}>+ New category</Button>{newCategoryOpen && <div className="mt-2 flex gap-2"><Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Category name" /><Button size="sm" onClick={addCategory}>Add</Button></div>}</div><div><Label>Apply to</Label><select className="native-control mt-2" value={sessionId} onChange={(event) => setSessionId(event.target.value)}><option value="">Overall booking</option>{booking.sessions.map((session) => <option key={session.id} value={session.id}>Schedule {session.sequence}{session.label ? ` · ${session.label}` : ""}</option>)}</select></div><div><Label>Amount</Label><MoneyInput className="mt-2" value={amount} onChange={setAmount} placeholder="0" /></div><div><Label>Description</Label><Input className="mt-2" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Optional detail" /></div><div className="flex gap-2"><Button onClick={() => void addCharge()}>Add charge</Button><Button variant="ghost" onClick={() => setAddingCharge(false)}>Cancel</Button></div></div>}
        </section>

        <ReminderHistoryList bookingId={booking.id} />

        <section className="mt-6 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Direct Expenses</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Only expenses linked to this booking are included.
              </p>
            </div>
            {canAddExpense && (
              <Button type="button" variant="outline" size="sm" onClick={() => onAddExpense(booking.id)}>
                Add Expense
              </Button>
            )}
          </div>
        </section>

        <section className="mt-6 border-t border-border pt-6">
          <h3 className="font-semibold">Invoice</h3>
          <p className="mt-1 text-sm text-muted-foreground">{relatedInvoice ? `${relatedInvoice.invoiceNumber ?? relatedInvoice.lifecycle} · Version ${relatedInvoice.version}` : "Create an invoice using this booking and its recorded payments."}</p>
          <Button className="mt-3" variant="outline" render={<Link href={`/invoices?booking=${encodeURIComponent(booking.id)}`} />}>
            {relatedInvoice ? "Open invoice" : "Create invoice"}
          </Button>
        </section>
      </section>
    </div>
  );
}
