"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  CalendarDaysIcon,
  FileTextIcon,
} from "lucide-react";

import DeleteAction from "@/components/system/DeleteAction";
import EmptyState from "@/components/system/EmptyState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BookingStatus } from "@/features/booking/types";
import type { DerivedPaymentStatus } from "@/features/payment/types";
import { latestInvoiceVersions, type Invoice } from "@/features/invoice/invoice";
import {
  formatRupiah,
} from "@/features/payment/utils/paymentCalculations";
import {
  firstBookingSession,
  formatSessionDate,
  formatSessionTime,
  sortBookingSessions,
} from "@/features/booking/utils/bookingSessions";
import type { BookingFinancialDetails } from "./BookingFinancialDetailsDialog";

type BookingWithNames = BookingFinancialDetails;

type BookingTableProps = {
  bookings: BookingWithNames[];
  onAdd: () => void;
  onEdit: (booking: BookingWithNames) => void;
  onDelete: (booking: BookingWithNames) => boolean | "blocked" | Promise<boolean | "blocked">;
  onStatusChange: (booking: BookingWithNames, status: BookingStatus) => boolean | Promise<boolean>;
  onFinancialDetailsClick: (booking: BookingWithNames) => void;
  invoices: Invoice[];
  timezone: string;
};

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  Scheduled: "bg-emerald-100 text-emerald-700",
  Completed: "bg-sky-100 text-sky-700",
  Cancelled: "bg-red-100 text-red-700",
};

const PAYMENT_STATUS_LABELS: Record<DerivedPaymentStatus, string> = {
  Outstanding: "Unpaid",
  "Partial Paid": "Part paid",
  "Fully Paid": "Paid",
  Cancelled: "Cancelled",
};

const PAYMENT_STATUS_STYLES: Record<DerivedPaymentStatus, string> = {
  Outstanding: "bg-zinc-200 text-zinc-700",
  "Partial Paid": "bg-amber-100 text-amber-700",
  "Fully Paid": "bg-emerald-100 text-emerald-700",
  Cancelled: "bg-red-100 text-red-700",
};

type BookingStatusControlProps = {
  booking: BookingWithNames;
  onStatusChange: (booking: BookingWithNames, status: BookingStatus) => boolean | Promise<boolean>;
};

function BookingStatusControl({
  booking,
  onStatusChange,
}: BookingStatusControlProps) {
  const [cancelOpen, setCancelOpen] = useState(false);

  function selectStatus(status: Exclude<BookingStatus, "Cancelled">) {
    if (status !== booking.bookingStatus) {
      onStatusChange(booking, status);
    }
  }

  function cancelBooking() {
    if (booking.bookingStatus !== "Cancelled") {
      onStatusChange(booking, "Cancelled");
    }
    setCancelOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={`rounded-full px-3 ${BOOKING_STATUS_STYLES[booking.bookingStatus]}`}
              aria-label={`Change status for ${booking.customerName}; currently ${booking.bookingStatus}`}
            />
          }
        >
          {booking.bookingStatus}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuItem onClick={() => selectStatus("Scheduled")}>
            Scheduled
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => selectStatus("Completed")}>
            Completed
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setCancelOpen(true)}>
            Cancel booking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the booking as cancelled. Payment records will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction type="button" variant="destructive" onClick={cancelBooking}>
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PaymentStatusControl({
  booking,
  onClick,
}: {
  booking: BookingWithNames;
  onClick: (booking: BookingWithNames) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`rounded-full px-3 ${PAYMENT_STATUS_STYLES[booking.paymentStatus]}`}
      onClick={() => onClick(booking)}
      aria-label={
        `View payment details for ${booking.customerName}`
      }
    >
      {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
    </Button>
  );
}

function formatFinancialValue(value: number | null): string {
  return value === null ? "—" : formatRupiah(value);
}

function financialValueClass(value: number | null): string {
  return value !== null && value < 0 ? "text-destructive" : "text-foreground";
}

type BookingActionsProps = {
  booking: BookingWithNames;
  onEdit: (booking: BookingWithNames) => void;
  onDelete: (booking: BookingWithNames) => boolean | "blocked" | Promise<boolean | "blocked">;
};

function BookingActions({
  booking,
  onEdit,
  onDelete,
}: BookingActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Open actions for ${booking.customerName}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onEdit(booking)}>
            <PencilIcon aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAction
        itemName="this booking"
        onConfirm={() => onDelete(booking)}
        successMessage="Booking deleted."
        errorMessage="Could not delete the booking. Try again."
        blockedMessage={"This booking has payment or expense records.\n\nRemove those records before deleting the booking."}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hideTrigger
      />
    </>
  );
}

function InvoiceSummary({ booking, invoices }: { booking: BookingWithNames; invoices: Invoice[] }) {
  const related = latestInvoiceVersions(invoices.filter((invoice) => invoice.bookingId === booking.id))
    .sort((left, right) => right.updatedAt - left.updatedAt);
  const latest = related[0];

  if (!latest) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-sm text-muted-foreground">No invoice</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Button type="button" variant="link" size="sm" className="h-auto px-0 py-0" render={<Link href={`/invoices?booking=${booking.id}&action=create`} />}>Create draft</Button>
          <Link href={`/invoices?booking=${booking.id}&action=issue`} className="text-xs font-medium text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Issue invoice</Link>
        </span>
      </div>
    );
  }

  const isIssued = latest.lifecycle === "Issued";
  const stateLabel = isIssued ? latest.invoiceNumber ?? "Issued" : "Draft";
  const summary = related.length > 1
    ? `${related.length} invoices · Latest ${stateLabel}`
    : stateLabel;

  return (
    <div className="flex flex-col items-start gap-1">
      <Link
        href={`/invoices?invoice=${latest.id}`}
        className="max-w-44 text-sm font-semibold text-foreground hover:text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {summary}
      </Link>
      {isIssued ? (
        <Link href={`/invoices?invoice=${latest.id}&action=download`} className="text-xs font-medium text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Download PDF</Link>
      ) : (
        <span className="flex items-center gap-2 text-xs font-medium">
          <Link href={`/invoices?invoice=${latest.id}&action=edit`} className="text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Edit</Link>
          <Link href={`/invoices?invoice=${latest.id}&action=issue`} className="text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Issue</Link>
        </span>
      )}
    </div>
  );
}

function ScheduleSummary({ booking, timezone }: { booking: BookingWithNames; timezone: string }) {
  const [open, setOpen] = useState(false);
  const sessions = sortBookingSessions(booking.sessions);
  const first = firstBookingSession(booking);

  if (sessions.length === 1) {
    return (
      <div>
        <span className="block">{formatSessionDate(first, timezone)}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{formatSessionTime(first, timezone)}</span>
        {first.location && <span className="mt-1 block text-sm text-muted-foreground">{first.location}</span>}
      </div>
    );
  }

  const compactDates = sessions
    .slice(0, 3)
    .map((session) => formatSessionDate(session, timezone, { day: "numeric", month: "short" }))
    .join(" · ");

  return (
    <>
      <button
        type="button"
        className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setOpen(true)}
      >
        <span className="block font-semibold text-foreground">{sessions.length} schedules</span>
        <span className="mt-1 block text-sm text-muted-foreground">
          {compactDates}{sessions.length > 3 ? ` · +${sessions.length - 3}` : ""}
        </span>
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-h-[85dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Complete schedule</AlertDialogTitle>
            <AlertDialogDescription>
              {booking.customerName} · {booking.serviceName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            {sessions.map((session, index) => (
              <div key={session.id} className="rounded-xl border border-border p-4">
                <p className="font-semibold text-foreground">
                  Schedule {index + 1}{session.label ? ` · ${session.label}` : ""}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatSessionDate(session, timezone)} · {formatSessionTime(session, timezone)}
                </p>
                {session.location && <p className="mt-1 text-sm text-muted-foreground">{session.location}</p>}
                {session.notes && <p className="mt-2 text-sm text-foreground">{session.notes}</p>}
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction type="button" onClick={() => setOpen(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function BookingTable({
  bookings,
  onAdd,
  onEdit,
  onDelete,
  onStatusChange,
  onFinancialDetailsClick,
  invoices,
  timezone,
}: BookingTableProps) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={CalendarDaysIcon}
        title="No bookings yet."
        description="Add your first booking to start tracking schedules and payments."
        actionLabel="Add booking"
        onAction={onAdd}
      />
    );
  }

  return (
    <section aria-label="Bookings">
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Client & service</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Booking</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead className="text-right">Est. Profit</TableHead>
              <TableHead className="w-16 px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="px-4 py-3 font-semibold whitespace-normal">
                  <span className="block">{booking.customerName}</span>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    {booking.serviceName}
                  </span>
                </TableCell>
                <TableCell className="py-3 whitespace-normal">
                  <ScheduleSummary booking={booking} timezone={timezone} />
                </TableCell>
                <TableCell className="py-3">
                  <BookingStatusControl booking={booking} onStatusChange={onStatusChange} />
                </TableCell>
                <TableCell className="py-3">
                  <PaymentStatusControl booking={booking} onClick={onFinancialDetailsClick} />
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {booking.remainingAmount === null
                      ? "—"
                      : `${formatRupiah(booking.remainingAmount)} remaining`}
                  </span>
                </TableCell>
                <TableCell className="py-3 whitespace-normal">
                  <InvoiceSummary booking={booking} invoices={invoices} />
                </TableCell>
                <TableCell className="py-3 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={`h-auto px-2 py-1 font-semibold ${financialValueClass(booking.estimatedProfit)}`}
                    onClick={() => onFinancialDetailsClick(booking)}
                    aria-label={`View financial details for ${booking.customerName}`}
                  >
                    {formatFinancialValue(booking.estimatedProfit)}
                  </Button>
                  {booking.estimatedProfit === null ? (
                    <span className="mt-1 block text-sm text-muted-foreground">Cancelled</span>
                  ) : booking.directExpenses > 0 ? (
                    <span className="mt-1 block text-sm text-muted-foreground">Expenses: {formatRupiah(booking.directExpenses)}</span>
                  ) : null}
                </TableCell>
                <TableCell className="px-4 py-2 text-right">
                  <BookingActions booking={booking} onEdit={onEdit} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 lg:hidden">
        {bookings.map((booking) => (
          <article
            key={booking.id}
            className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-foreground">{booking.customerName}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{booking.serviceName}</p>
                <div className="mt-2 text-sm text-muted-foreground">
                  <ScheduleSummary booking={booking} timezone={timezone} />
                </div>
              </div>
              <BookingActions booking={booking} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <BookingStatusControl booking={booking} onStatusChange={onStatusChange} />
              <PaymentStatusControl booking={booking} onClick={onFinancialDetailsClick} />
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-muted/55 px-3 py-2">
              <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <InvoiceSummary booking={booking} invoices={invoices} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Paid</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatRupiah(booking.totalPaid)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Remaining</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatFinancialValue(booking.remainingAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Est. Profit</dt>
                <dd className={`mt-1 font-semibold ${financialValueClass(booking.estimatedProfit)}`}>
                  {formatFinancialValue(booking.estimatedProfit)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
