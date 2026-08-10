"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Booking, CreateBookingInput, UpdateBookingInput } from "@/features/booking/types";
import { bookingSchema, BookingFormValues } from "@/features/booking/schema";
import { doesBookingEndNextDay } from "@/features/booking/utils/bookingDateRange";
import { Service } from "@/features/service/types";
import { Payment } from "@/features/payment/types";
import { formatRupiah, getPaymentLabel } from "@/features/payment/utils/paymentCalculations";
import { Expense } from "@/features/expense/types";
import { getBookingExpenses } from "@/features/expense/utils/expenseAggregations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ActionButton from "@/components/system/ActionButton";
import DeleteAction from "@/components/system/DeleteAction";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";
import { Info, XIcon } from "lucide-react";

type BookingDialogProps = {
  open: boolean;
  booking: Booking | null;
  initialValues?: BookingFormValues;
  customers: { id: string; name: string }[];
  services: Service[];
  payments: Payment[];
  expenses: Expense[];
  onClose: () => void;
  onCreate: (input: CreateBookingInput) => boolean | Promise<boolean>;
  onUpdate: (input: UpdateBookingInput) => boolean | Promise<boolean>;
  onAddPaymentClick: (bookingId: string, remainingAmount: number) => void;
  onEditPaymentClick: (payment: Payment) => void;
  onDeletePayment: (id: string) => boolean | Promise<boolean>;
};

const defaultValues: BookingFormValues = {
  customerId: "",
  serviceId: "",
  bookingDate: "",
  startTime: "",
  endTime: "",
  location: "",
  servicePrice: 0,
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "",
  notes: "",
};

export default function BookingDialog({
  open,
  booking,
  initialValues,
  customers,
  services,
  payments,
  expenses,
  onClose,
  onCreate,
  onUpdate,
  onAddPaymentClick,
  onEditPaymentClick,
  onDeletePayment,
}: BookingDialogProps) {
  const action = useActionGuard();
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof bookingSchema>, undefined, BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open) return;

    if (booking) {
      reset({
        customerId: booking.customerId,
        serviceId: booking.serviceId,
        bookingDate: booking.bookingDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        location: booking.location,
        servicePrice: booking.servicePrice,
        bookingStatus: booking.bookingStatus,
        fullPaymentDueDate: booking.fullPaymentDueDate,
        notes: booking.notes,
      });
      return;
    }

    reset({
      ...defaultValues,
      ...(initialValues ?? {}),
    });
  }, [open, booking, initialValues, reset]);

  const selectedServiceId = watch("serviceId");
  const bookingDateValue = watch("bookingDate");
  const startTimeValue = watch("startTime");
  const endTimeValue = watch("endTime");
  const servicePriceValue = watch("servicePrice");
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const bookingPayments = booking ? payments.filter((payment) => payment.bookingId === booking.id) : [];

  // Booking Profit ??computed from payments and expenses for this booking
  const totalPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0);
  const bookingExpensesTotal = booking ? getBookingExpenses(booking.id, expenses) : 0;
  const effectivePrice = Number(servicePriceValue) || 0;
  const isCancelled = booking?.bookingStatus === "Cancelled";
  const outstanding = isCancelled ? 0 : Math.max(effectivePrice - totalPaid, 0);
  const canAddPayment = !isCancelled && outstanding > 0;
  const netRevenue = totalPaid - bookingExpensesTotal;
  const endsNextDay = doesBookingEndNextDay(startTimeValue, endTimeValue);

  useEffect(() => {
    if (!selectedService) return;
    setValue("servicePrice", selectedService.price, { shouldValidate: true });
  }, [selectedService, setValue]);

  useEffect(() => {
    if (!selectedService || !startTimeValue) return;

    const [hh, mm] = startTimeValue.split(":");
    const date = new Date();
    date.setHours(Number(hh), Number(mm), 0, 0);
    date.setMinutes(date.getMinutes() + selectedService.duration);
    const endHH = String(date.getHours()).padStart(2, "0");
    const endMM = String(date.getMinutes()).padStart(2, "0");
    setValue("endTime", `${endHH}:${endMM}`, { shouldValidate: true });
  }, [selectedService, startTimeValue, setValue]);

  function handleClose() {
    reset(defaultValues);
    onClose();
  }

  async function onSubmit(values: BookingFormValues) {
    const succeeded = await action.run(() => booking ? onUpdate({ id: booking.id, ...values }) : onCreate(values));
    if (!succeeded) {
      notify.error("Could not save the booking. Try again.");
      return;
    }
    notify.success(booking ? "Booking updated." : "Booking saved.");
    handleClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => !action.pending && handleClose()}>
      <div className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="dialog-title">{booking ? "Edit Booking" : "Add Booking"}</h2>
            <p className="mt-2 text-slate-500">
              {booking ? "Update booking and payment details." : "Create a new booking."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={action.pending} onClick={handleClose} aria-label="Close booking form">
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div>
            <Label className="mb-2 block font-semibold">Customer</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a customer">
                      {field.value ? (customers.find((c) => c.id === field.value)?.name ?? "Unknown customer") : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.customerId && <p className="mt-2 text-sm text-destructive">{errors.customerId.message}</p>}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Service</Label>
            <Controller
              control={control}
              name="serviceId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a service">
                      {field.value ? (services.find((s) => s.id === field.value)?.name ?? "Unknown service") : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.serviceId && <p className="mt-2 text-sm text-destructive">{errors.serviceId.message}</p>}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block font-semibold">Booking Date</Label>
              <Input type="date" {...register("bookingDate")} />
              {errors.bookingDate && <p className="mt-2 text-sm text-destructive">{errors.bookingDate.message}</p>}
            </div>
            <div>
              <Label className="mb-2 block font-semibold">Location</Label>
              <Input {...register("location")} />
              {errors.location && <p className="mt-2 text-sm text-destructive">{errors.location.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block font-semibold">Start Time</Label>
              <Input type="time" {...register("startTime")} />
              {errors.startTime && <p className="mt-2 text-sm text-destructive">{errors.startTime.message}</p>}
            </div>
            <div>
              <Label className="mb-2 block font-semibold">End Time</Label>
              <Input type="time" {...register("endTime")} />
              {errors.endTime && <p className="mt-2 text-sm text-destructive">{errors.endTime.message}</p>}
            </div>
          </div>
          {bookingDateValue && startTimeValue && endTimeValue && endsNextDay === true && (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0" aria-hidden="true" />
              <span>Ends the next day.</span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block font-semibold">Service Price</Label>
              <Controller
                control={control}
                name="servicePrice"
                render={({ field }) => (
                  <MoneyInput
                    name={field.name}
                    ref={field.ref}
                    value={Number(field.value) || 0}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    aria-invalid={Boolean(errors.servicePrice)}
                    placeholder="0"
                  />
                )}
              />
              {errors.servicePrice && <p className="mt-2 text-sm text-destructive">{errors.servicePrice.message}</p>}
            </div>
            <div>
              <Label className="mb-2 block font-semibold">Full Payment Due Date</Label>
              <Input type="date" {...register("fullPaymentDueDate")} />
              {errors.fullPaymentDueDate && <p className="mt-2 text-sm text-destructive">{errors.fullPaymentDueDate.message}</p>}
            </div>
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Booking Status</Label>
            <Controller
              control={control}
              name="bookingStatus"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Scheduled">Scheduled</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.bookingStatus && <p className="mt-2 text-sm text-destructive">{errors.bookingStatus.message}</p>}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Notes</Label>
            <Textarea rows={4} {...register("notes")} />
          </div>

          <div className="rounded-2xl border border-zinc-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Payment History</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!booking || !canAddPayment}
                onClick={() => booking && onAddPaymentClick(booking.id, outstanding)}
              >
                Add Payment
              </Button>
            </div>
            {!booking ? (
              <p className="text-sm text-zinc-500">Save booking first to add payments.</p>
            ) : (
              <>
                {bookingPayments.length === 0 ? (
                  <p className="text-sm text-zinc-500">No payment transactions yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...bookingPayments]
                      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
                      .map((payment) => {
                        const label = getPaymentLabel(payment, bookingPayments, Number(servicePriceValue) || 0);
                        return (
                          <div key={payment.id} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-slate-900">{payment.date} · {label}</div>
                              <div className="truncate text-zinc-600">{payment.method}{payment.notes ? ` · ${payment.notes}` : ""}</div>
                            </div>
                            <div className="shrink-0 font-semibold text-slate-900">{formatRupiah(payment.amount)}</div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => onEditPaymentClick(payment)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-zinc-200"
                              >
                                Edit
                              </button>
                              <DeleteAction
                                itemName="this payment"
                                onConfirm={() => onDeletePayment(payment.id)}
                                successMessage="Payment deleted."
                                errorMessage="Could not delete the payment. Try again."
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
                {!canAddPayment && (
                  <p className="mt-3 text-sm text-zinc-500">
                    {booking.bookingStatus === "Cancelled"
                      ? "Cancelled bookings cannot accept payments."
                      : "This booking is fully paid."}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Booking Profit ??only shown when editing */}
          {booking && (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <h3 className="mb-3 font-semibold text-slate-900">Booking Profit</h3>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-zinc-500">Booking Value</p>
                  <p className="font-semibold text-slate-900">{formatRupiah(effectivePrice)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Paid</p>
                  <p className="font-semibold text-emerald-700">{formatRupiah(totalPaid)}</p>
                </div>
                {!isCancelled && (
                  <div>
                    <p className="text-zinc-500">Outstanding</p>
                    <p className="font-semibold text-amber-700">{formatRupiah(outstanding)}</p>
                  </div>
                )}
                <div>
                  <p className="text-zinc-500">Booking Expenses</p>
                  <p className="font-semibold text-rose-700">{formatRupiah(bookingExpensesTotal)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Net Revenue</p>
                  <p className={`font-semibold ${isCancelled ? "text-slate-900" : netRevenue >= 0 ? "text-sky-700" : "text-red-700"}`}>
                    {isCancelled ? "Not applicable" : formatRupiah(netRevenue)}
                  </p>
                </div>
              </div>
              {isCancelled && (
                <p className="mt-3 text-sm text-zinc-500">
                  Cancelled bookings are excluded from profit and outstanding totals.
                </p>
              )}
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={action.pending} onClick={handleClose}>
              Cancel
            </Button>
            <ActionButton type="submit" loading={action.pending || isSubmitting} loadingText={booking ? "Updating…" : "Saving…"}>
              {booking ? "Update Booking" : "Save Booking"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
