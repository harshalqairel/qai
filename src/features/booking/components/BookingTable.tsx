"use client";

import { useState } from "react";
import {
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  CalendarDaysIcon,
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
import type { Booking, BookingStatus } from "@/features/booking/types";
import type { DerivedPaymentStatus } from "@/features/payment/types";
import {
  formatRupiah,
} from "@/features/payment/utils/paymentCalculations";
import { formatBookingTimeRange } from "@/features/booking/utils/bookingDateRange";

type BookingWithNames = Booking & {
  customerName: string;
  serviceName: string;
  paymentStatus: DerivedPaymentStatus;
  totalPaid: number;
  remainingAmount: number;
};

type BookingTableProps = {
  bookings: BookingWithNames[];
  onEdit: (booking: BookingWithNames) => void;
  onDelete: (booking: BookingWithNames) => boolean | "blocked";
  onStatusChange: (booking: BookingWithNames, status: BookingStatus) => boolean;
  onPaymentStatusClick: (booking: BookingWithNames) => void;
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
  onStatusChange: (booking: BookingWithNames, status: BookingStatus) => boolean;
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
  const canQuickPay = booking.bookingStatus !== "Cancelled" && booking.remainingAmount > 0;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`rounded-full px-3 ${PAYMENT_STATUS_STYLES[booking.paymentStatus]}`}
      onClick={() => onClick(booking)}
      aria-label={
        canQuickPay
          ? `Record the remaining ${formatRupiah(booking.remainingAmount)} for ${booking.customerName}`
          : `View payment details for ${booking.customerName}`
      }
    >
      {PAYMENT_STATUS_LABELS[booking.paymentStatus]}
    </Button>
  );
}

type BookingActionsProps = {
  booking: BookingWithNames;
  onEdit: (booking: BookingWithNames) => void;
  onDelete: (booking: BookingWithNames) => boolean | "blocked";
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

export default function BookingTable({
  bookings,
  onEdit,
  onDelete,
  onStatusChange,
  onPaymentStatusClick,
}: BookingTableProps) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={CalendarDaysIcon}
        title="No bookings yet."
        description="Add a booking when you are ready."
      />
    );
  }

  return (
    <section aria-label="Bookings">
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Customer</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Date & time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-16 px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookings.map((booking) => (
              <TableRow key={booking.id}>
                <TableCell className="px-4 py-3 font-semibold whitespace-normal">
                  {booking.customerName}
                </TableCell>
                <TableCell className="max-w-48 py-3 whitespace-normal">
                  <span className="block truncate">{booking.serviceName}</span>
                  {booking.location && (
                    <span className="mt-1 block truncate text-sm text-muted-foreground">
                      {booking.location}
                    </span>
                  )}
                </TableCell>
                <TableCell className="py-3 whitespace-normal">
                  <span className="block">{booking.bookingDate}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {formatBookingTimeRange(booking.bookingDate, booking.startTime, booking.endTime)}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <BookingStatusControl booking={booking} onStatusChange={onStatusChange} />
                </TableCell>
                <TableCell className="py-3">
                  <PaymentStatusControl booking={booking} onClick={onPaymentStatusClick} />
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {formatRupiah(booking.remainingAmount)} remaining
                  </span>
                </TableCell>
                <TableCell className="py-3 text-right font-medium">
                  <span className="block">{formatRupiah(booking.totalPaid)}</span>
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    of {formatRupiah(booking.servicePrice)}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-2 text-right">
                  <BookingActions booking={booking} onEdit={onEdit} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 sm:hidden">
        {bookings.map((booking) => (
          <article
            key={booking.id}
            className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-foreground">{booking.customerName}</h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">{booking.serviceName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {booking.bookingDate} · {formatBookingTimeRange(booking.bookingDate, booking.startTime, booking.endTime)}
                </p>
              </div>
              <BookingActions booking={booking} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <BookingStatusControl booking={booking} onStatusChange={onStatusChange} />
              <PaymentStatusControl booking={booking} onClick={onPaymentStatusClick} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Paid</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatRupiah(booking.totalPaid)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Remaining</dt>
                <dd className="mt-1 font-semibold text-foreground">{formatRupiah(booking.remainingAmount)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
