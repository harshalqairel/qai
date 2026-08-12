"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Booking, CreateBookingCommand, UpdateBookingInput } from "@/features/booking/types";
import { bookingSchema, BookingFormValues } from "@/features/booking/schema";
import { doesBookingEndNextDay } from "@/features/booking/utils/bookingDateRange";
import { instantParts, sessionToFormValues } from "@/features/booking/utils/bookingSessions";
import { Service } from "@/features/service/types";
import type { CreateServiceInput } from "@/features/service/types";
import type { CreateCustomerInput, Customer } from "@/features/customer/types";
import type { ServiceCategory } from "@/features/service-category/types";
import { InitialPaymentInput, Payment } from "@/features/payment/types";
import { PAYMENT_METHODS } from "@/features/payment/constants";
import { initialPaymentSchemaForBooking } from "@/features/payment/schema";
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
import { Copy, Info, Plus, Trash2, XIcon } from "lucide-react";

type BookingDialogProps = {
  open: boolean;
  booking: Booking | null;
  initialValues?: BookingFormValues;
  customers: { id: string; name: string }[];
  services: Service[];
  serviceCategories?: ServiceCategory[];
  payments: Payment[];
  expenses: Expense[];
  timezone: string;
  onQuickCreateCustomer?: (input: CreateCustomerInput) => Promise<Customer | null>;
  onQuickCreateService?: (input: CreateServiceInput) => Promise<Service | null>;
  onQuickCreateServiceCategory?: (name: string) => Promise<ServiceCategory | null>;
  onClose: () => void;
  onCreate: (command: CreateBookingCommand) => boolean | Promise<boolean>;
  onUpdate: (input: UpdateBookingInput) => boolean | Promise<boolean>;
  onAddPaymentClick: (bookingId: string, remainingAmount: number) => void;
  onEditPaymentClick: (payment: Payment) => void;
  onDeletePayment: (id: string) => boolean | Promise<boolean>;
};

const defaultValues: BookingFormValues = {
  customerId: "",
  serviceId: "",
  sessions: [{ label: "", date: "", startTime: "", endTime: "", location: "", notes: "" }],
  servicePrice: 0,
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "",
  notes: "",
};

function defaultInitialPayment(timezone: string): InitialPaymentInput {
  return {
    amount: 0,
    method: "Bank Transfer",
    date: instantParts(new Date().toISOString(), timezone).date,
    notes: "",
  };
}

export default function BookingDialog({
  open,
  booking,
  initialValues,
  customers,
  services,
  serviceCategories = [],
  payments,
  expenses,
  timezone,
  onQuickCreateCustomer,
  onQuickCreateService,
  onQuickCreateServiceCategory,
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
  const { fields: scheduleFields, append, remove, replace } = useFieldArray({ control, name: "sessions" });
  const watchedSessions = useWatch({ control, name: "sessions" });
  const lastDefaultedServiceId = useRef<string | null>(null);
  const creationRequestId = useRef("");
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
  const [quickServiceOpen, setQuickServiceOpen] = useState(false);
  const [quickPending, setQuickPending] = useState(false);
  const [quickError, setQuickError] = useState("");
  const [quickCustomer, setQuickCustomer] = useState({ name: "", phone: "" });
  const [quickService, setQuickService] = useState({
    name: "",
    categoryId: "",
    price: 0,
    duration: 60,
    defaultSessionCount: 1,
  });
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [initialPaymentOpen, setInitialPaymentOpen] = useState(false);
  const [initialPayment, setInitialPayment] = useState<InitialPaymentInput>(() => defaultInitialPayment(timezone));
  const [initialPaymentErrors, setInitialPaymentErrors] = useState<Partial<Record<keyof InitialPaymentInput, string>>>({});

  useEffect(() => {
    if (!open) return;

    if (booking) {
      setInitialPaymentOpen(false);
      setInitialPaymentErrors({});
      reset({
        customerId: booking.customerId,
        serviceId: booking.serviceId,
        sessions: booking.sessions.map((session) => sessionToFormValues(session, timezone)),
        servicePrice: booking.servicePrice,
        bookingStatus: booking.bookingStatus,
        fullPaymentDueDate: booking.fullPaymentDueDate,
        notes: booking.notes,
      });
      return;
    }

    lastDefaultedServiceId.current = null;
    creationRequestId.current = crypto.randomUUID();
    setInitialPaymentOpen(false);
    setInitialPayment(defaultInitialPayment(timezone));
    setInitialPaymentErrors({});
    reset({
      ...defaultValues,
      ...(initialValues ?? {}),
    });
  }, [open, booking, initialValues, reset, timezone]);

  const selectedServiceId = watch("serviceId");
  const servicePriceValue = watch("servicePrice");
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const bookingPayments = booking ? payments.filter((payment) => payment.bookingId === booking.id) : [];

  // Booking Profit — computed from payments and expenses for this booking
  const totalPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0);
  const bookingExpensesTotal = booking ? getBookingExpenses(booking.id, expenses) : 0;
  const effectivePrice = Number(servicePriceValue) || 0;
  const isCancelled = booking?.bookingStatus === "Cancelled";
  const outstanding = isCancelled ? 0 : Math.max(effectivePrice - totalPaid, 0);
  const canAddPayment = !isCancelled && outstanding > 0;
  const netRevenue = totalPaid - bookingExpensesTotal;

  useEffect(() => {
    if (!selectedService) return;
    setValue("servicePrice", selectedService.price, { shouldValidate: true });
  }, [selectedService, setValue]);

  useEffect(() => {
    if (!selectedService || booking || lastDefaultedServiceId.current === selectedService.id) return;
    lastDefaultedServiceId.current = selectedService.id;
    const current = watchedSessions ?? [];
    const untouched = current.every((session) =>
      !session.date && !session.startTime && !session.endTime && !session.location && !session.label && !session.notes,
    );
    if (!untouched) return;
    replace(Array.from({ length: selectedService.defaultSessionCount }, () => ({
      label: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      notes: "",
    })));
  }, [selectedService, booking, watchedSessions, replace]);

  function suggestEndTime(index: number) {
    const startTime = watchedSessions?.[index]?.startTime;
    if (!selectedService || !startTime || watchedSessions?.[index]?.endTime) return;
    const [hours, minutes] = startTime.split(":").map(Number);
    const end = new Date(2000, 0, 1, hours, minutes + selectedService.duration);
    setValue(
      `sessions.${index}.endTime`,
      `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
      { shouldValidate: true },
    );
  }

  function duplicateSession(index: number) {
    const source = watchedSessions?.[index];
    if (!source || scheduleFields.length >= 50) return;
    append({
      label: "",
      date: "",
      startTime: source.startTime ?? "",
      endTime: source.endTime ?? "",
      location: source.location ?? "",
      notes: source.notes ?? "",
    });
  }

  function applyLocationToAll(index: number) {
    const location = watchedSessions?.[index]?.location?.trim();
    if (!location) return;
    scheduleFields.forEach((_, sessionIndex) => {
      setValue(`sessions.${sessionIndex}.location`, location, { shouldDirty: true });
    });
    notify.success("Location applied to every schedule.");
  }

  async function createCustomerInline() {
    if (!onQuickCreateCustomer || !quickCustomer.name.trim() || !quickCustomer.phone.trim()) {
      setQuickError("Client name and phone are required.");
      return;
    }
    setQuickPending(true);
    setQuickError("");
    const created = await onQuickCreateCustomer({
      name: quickCustomer.name.trim(),
      phone: quickCustomer.phone.trim(),
      instagram: "",
      email: "",
      notes: "",
    });
    setQuickPending(false);
    if (!created) {
      setQuickError("Could not add the customer.");
      return;
    }
    setValue("customerId", created.id, { shouldValidate: true });
    setQuickCustomer({ name: "", phone: "" });
    setQuickCustomerOpen(false);
    notify.success("Client added and selected.");
  }

  async function createServiceInline() {
    if (!onQuickCreateService || !quickService.name.trim() || !quickService.categoryId) {
      setQuickError("Service name and category are required.");
      return;
    }
    if (quickService.price <= 0 || quickService.duration <= 0 || quickService.defaultSessionCount < 1) {
      setQuickError("Enter a valid price, duration, and session count.");
      return;
    }
    setQuickPending(true);
    setQuickError("");
    const created = await onQuickCreateService({
      name: quickService.name.trim(),
      categoryId: quickService.categoryId,
      price: quickService.price,
      duration: quickService.duration,
      defaultSessionCount: quickService.defaultSessionCount,
      description: "",
    });
    setQuickPending(false);
    if (!created) {
      setQuickError("Could not add the service.");
      return;
    }
    setValue("serviceId", created.id, { shouldValidate: true });
    setQuickService({ name: "", categoryId: "", price: 0, duration: 60, defaultSessionCount: 1 });
    setQuickServiceOpen(false);
    notify.success("Service added without losing the booking details.");
  }

  async function createServiceCategoryInline() {
    if (!onQuickCreateServiceCategory || !quickCategoryName.trim()) {
      setQuickError("Category name is required.");
      return;
    }
    setQuickPending(true);
    setQuickError("");
    try {
      const created = await onQuickCreateServiceCategory(quickCategoryName.trim());
      if (!created) throw new Error("CATEGORY_CREATE_FAILED");
      setQuickService((value) => ({ ...value, categoryId: created.id }));
      setQuickCategoryName("");
      notify.success("Category added and selected.");
    } catch {
      setQuickError("Could not add that category. Check for a duplicate name.");
    } finally {
      setQuickPending(false);
    }
  }

  function handleClose() {
    reset(defaultValues);
    setInitialPaymentOpen(false);
    setInitialPaymentErrors({});
    onClose();
  }

  async function onSubmit(values: BookingFormValues) {
    let createCommand: CreateBookingCommand | null = null;
    if (!booking) {
      let parsedInitialPayment: InitialPaymentInput | null = null;
      if (initialPaymentOpen) {
        const parsed = initialPaymentSchemaForBooking(values.servicePrice).safeParse(initialPayment);
        if (!parsed.success) {
          const nextErrors: Partial<Record<keyof InitialPaymentInput, string>> = {};
          for (const issue of parsed.error.issues) {
            const field = issue.path[0];
            if (typeof field === "string" && !(field in nextErrors)) {
              nextErrors[field as keyof InitialPaymentInput] = issue.message;
            }
          }
          setInitialPaymentErrors(nextErrors);
          return;
        }
        parsedInitialPayment = parsed.data;
      }
      setInitialPaymentErrors({});
      createCommand = {
        requestId: creationRequestId.current || crypto.randomUUID(),
        booking: values,
        initialPayment: parsedInitialPayment,
      };
    }

    const succeeded = await action.run(() => booking
      ? onUpdate({ id: booking.id, ...values })
      : onCreate(createCommand!));
    if (!succeeded) {
      notify.error("Could not save the booking. Try again.");
      return;
    }
    notify.success(booking ? "Booking updated." : "Booking saved.");
    handleClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm" role="presentation" onClick={() => !action.pending && handleClose()}>
      <div className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl sm:p-8" role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-6 flex items-center justify-between border-b border-border bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:-mt-8 sm:mb-8 sm:px-8 sm:py-5">
          <div>
            <h2 id="booking-dialog-title" className="dialog-title">{booking ? "Edit Booking" : "Add Booking"}</h2>
            <p className="mt-2 text-slate-500">
              {booking ? "Update the booking details." : "Client, service, schedule, and price are all you need."}
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
            <Label className="mb-2 block font-semibold">Client</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a client">
                      {field.value ? (customers.find((c) => c.id === field.value)?.name ?? "Client not found") : undefined}
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
            {onQuickCreateCustomer && (
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => { setQuickCustomerOpen((value) => !value); setQuickError(""); }}>
                  <Plus className="size-4" aria-hidden="true" /> Add new client
                </Button>
                {quickCustomerOpen && (
                  <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <div><Label className="mb-2 block">Client name</Label><Input value={quickCustomer.name} onChange={(event) => setQuickCustomer((value) => ({ ...value, name: event.target.value }))} /></div>
                    <div><Label className="mb-2 block">Phone</Label><Input inputMode="tel" value={quickCustomer.phone} onChange={(event) => setQuickCustomer((value) => ({ ...value, phone: event.target.value }))} /></div>
                    {quickError && <p className="text-sm text-destructive">{quickError}</p>}
                    <div className="flex gap-2"><Button type="button" size="sm" disabled={quickPending} onClick={createCustomerInline}>{quickPending ? "Adding…" : "Add and select"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setQuickCustomerOpen(false)}>Cancel</Button></div>
                  </div>
                )}
              </div>
            )}
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
            {onQuickCreateService && (
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  setQuickServiceOpen((value) => !value);
                  setQuickError("");
                  setQuickService((value) => ({ ...value, categoryId: value.categoryId || serviceCategories.find((category) => category.active)?.id || "" }));
                }}>
                  <Plus className="size-4" aria-hidden="true" /> Add new service
                </Button>
                {quickServiceOpen && (
                  <div className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-4">
                    <div><Label className="mb-2 block">Service name</Label><Input value={quickService.name} onChange={(event) => setQuickService((value) => ({ ...value, name: event.target.value }))} /></div>
                    <div>
                      <Label className="mb-2 block">Category</Label>
                      <Select value={quickService.categoryId} onValueChange={(categoryId) => setQuickService((value) => ({ ...value, categoryId: categoryId ?? "" }))}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category">
                            {quickService.categoryId
                              ? serviceCategories.find((category) => category.id === quickService.categoryId)?.name ?? "Selected category"
                              : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>{serviceCategories.filter((category) => category.active).map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {onQuickCreateServiceCategory && (
                      <div>
                        <Label className="mb-2 block">New category</Label>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                          <Input value={quickCategoryName} onChange={(event) => setQuickCategoryName(event.target.value)} placeholder="e.g. Makeup" />
                          <Button type="button" variant="outline" disabled={quickPending} onClick={createServiceCategoryInline}>Add category</Button>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="mb-2 block">Price</Label><MoneyInput value={quickService.price} onChange={(price) => setQuickService((value) => ({ ...value, price }))} /></div>
                      <div><Label className="mb-2 block">Typical duration</Label><Input type="number" min={1} inputMode="numeric" value={quickService.duration} onChange={(event) => setQuickService((value) => ({ ...value, duration: Number(event.target.value) }))} /></div>
                    </div>
                    <div><Label className="mb-2 block">Usual number of schedules</Label><Input type="number" min={1} max={50} inputMode="numeric" value={quickService.defaultSessionCount} onChange={(event) => setQuickService((value) => ({ ...value, defaultSessionCount: Number(event.target.value) }))} /></div>
                    {quickError && <p className="text-sm text-destructive">{quickError}</p>}
                    <div className="flex gap-2"><Button type="button" size="sm" disabled={quickPending} onClick={createServiceInline}>{quickPending ? "Adding…" : "Add and select"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setQuickServiceOpen(false)}>Cancel</Button></div>
                  </div>
                )}
              </div>
            )}
          </div>

          <section className="space-y-4" aria-labelledby="booking-schedule-heading">
            <div>
              <h3 id="booking-schedule-heading" className="font-semibold text-foreground">Schedule</h3>
              <p className="mt-1 text-sm text-muted-foreground">Add every date included in this booking.</p>
            </div>
            {scheduleFields.map((field, index) => {
              const sessionError = errors.sessions?.[index];
              const session = watchedSessions?.[index];
              const endsNextDay = doesBookingEndNextDay(session?.startTime ?? "", session?.endTime ?? "");
              const startTimeField = register(`sessions.${index}.startTime`);
              return (
                <div key={field.id} className="space-y-4 rounded-2xl border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">Schedule {index + 1}</p>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" disabled={scheduleFields.length >= 50} onClick={() => duplicateSession(index)} aria-label={`Duplicate schedule ${index + 1}`}>
                        <Copy className="size-4" aria-hidden="true" /> Duplicate
                      </Button>
                      {scheduleFields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => remove(index)}
                          aria-label={`Remove schedule ${index + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                  <input type="hidden" {...register(`sessions.${index}.id`)} />
                  <div>
                    <Label className="mb-2 block">Date</Label>
                    <Input type="date" {...register(`sessions.${index}.date`)} />
                    {sessionError?.date && <p className="mt-2 text-sm text-destructive">{sessionError.date.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <Label className="mb-2 block">Start time</Label>
                      <Input
                        type="time"
                        {...startTimeField}
                        onBlur={(event) => {
                          void startTimeField.onBlur(event);
                          suggestEndTime(index);
                        }}
                      />
                      {sessionError?.startTime && <p className="mt-2 text-sm text-destructive">{sessionError.startTime.message}</p>}
                    </div>
                    <div className="min-w-0">
                      <Label className="mb-2 block">End time</Label>
                      <Input type="time" {...register(`sessions.${index}.endTime`)} />
                      {sessionError?.endTime && <p className="mt-2 text-sm text-destructive">{sessionError.endTime.message}</p>}
                    </div>
                  </div>
                  {endsNextDay === true && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Info className="size-4 shrink-0" aria-hidden="true" /> Ends the next day.
                    </p>
                  )}
                  <div>
                    <Label className="mb-2 block">Location <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input {...register(`sessions.${index}.location`)} />
                    {scheduleFields.length > 1 && session?.location?.trim() && (
                      <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => applyLocationToAll(index)}>
                        Apply this location to all
                      </Button>
                    )}
                  </div>
                  <details className="group rounded-xl border border-border bg-white">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      Optional schedule details
                    </summary>
                    <div className="space-y-4 border-t border-border p-4">
                      <div>
                        <Label className="mb-2 block">Label</Label>
                        <Input {...register(`sessions.${index}.label`)} placeholder="e.g. Akad, Reception, Class 2" />
                        {sessionError?.label && <p className="mt-2 text-sm text-destructive">{sessionError.label.message}</p>}
                      </div>
                      <div>
                        <Label className="mb-2 block">Notes</Label>
                        <Textarea rows={2} {...register(`sessions.${index}.notes`)} />
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
            {typeof errors.sessions?.message === "string" && (
              <p className="text-sm text-destructive">{errors.sessions.message}</p>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={scheduleFields.length >= 50}
              onClick={() => append({ label: "", date: "", startTime: "", endTime: "", location: "", notes: "" })}
            >
              <Plus className="size-4" aria-hidden="true" /> Add another schedule
            </Button>
          </section>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block font-semibold">Price</Label>
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
              <Label className="mb-2 block font-semibold">Payment due date</Label>
              <Input type="date" {...register("fullPaymentDueDate")} />
              {errors.fullPaymentDueDate && <p className="mt-2 text-sm text-destructive">{errors.fullPaymentDueDate.message}</p>}
            </div>
          </div>

          {!booking && (
            <section className="rounded-2xl border border-border bg-muted/20 p-4" aria-labelledby="initial-payment-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 id="initial-payment-heading" className="font-semibold text-foreground">
                    Initial payment <span className="font-normal text-muted-foreground">(optional)</span>
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Record a deposit received when this booking is created.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={initialPaymentOpen}
                  aria-controls="initial-payment-fields"
                  onClick={() => {
                    setInitialPaymentOpen((value) => !value);
                    setInitialPaymentErrors({});
                  }}
                >
                  {initialPaymentOpen ? "Remove initial payment" : "Add initial payment"}
                </Button>
              </div>

              {initialPaymentOpen && (
                <div id="initial-payment-fields" className="mt-5 space-y-4 border-t border-border pt-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="initial-payment-amount" className="mb-2 block">Amount</Label>
                      <MoneyInput
                        id="initial-payment-amount"
                        value={initialPayment.amount}
                        onChange={(amount) => setInitialPayment((value) => ({ ...value, amount }))}
                        aria-invalid={Boolean(initialPaymentErrors.amount)}
                        placeholder="0"
                      />
                      {initialPaymentErrors.amount && (
                        <p className="mt-2 text-sm text-destructive">{initialPaymentErrors.amount}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="initial-payment-date" className="mb-2 block">Payment date</Label>
                      <Input
                        id="initial-payment-date"
                        type="date"
                        value={initialPayment.date}
                        onChange={(event) => setInitialPayment((value) => ({ ...value, date: event.target.value }))}
                        aria-invalid={Boolean(initialPaymentErrors.date)}
                      />
                      {initialPaymentErrors.date && (
                        <p className="mt-2 text-sm text-destructive">{initialPaymentErrors.date}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Payment method</Label>
                    <Select
                      value={initialPayment.method}
                      onValueChange={(method) => setInitialPayment((value) => ({
                        ...value,
                        method: method as InitialPaymentInput["method"],
                      }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {initialPaymentErrors.method && (
                      <p className="mt-2 text-sm text-destructive">{initialPaymentErrors.method}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="initial-payment-notes" className="mb-2 block">
                      Notes <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="initial-payment-notes"
                      rows={2}
                      value={initialPayment.notes}
                      onChange={(event) => setInitialPayment((value) => ({ ...value, notes: event.target.value }))}
                      placeholder="e.g. Deposit / DP"
                    />
                    {initialPaymentErrors.notes && (
                      <p className="mt-2 text-sm text-destructive">{initialPaymentErrors.notes}</p>
                    )}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Payment status and remaining balance are calculated automatically.
                  </p>
                </div>
              )}
            </section>
          )}

          <div>
            <Label className="mb-2 block font-semibold">Booking status</Label>
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

          {booking && (
          <div className="rounded-2xl border border-zinc-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Payment History</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAddPayment}
                onClick={() => onAddPaymentClick(booking.id, outstanding)}
              >
                Add Payment
              </Button>
            </div>
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
          </div>
          )}

          {/* Booking Profit — only shown when editing */}
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
                    <p className="text-zinc-500">Unpaid amount</p>
                    <p className="font-semibold text-amber-700">{formatRupiah(outstanding)}</p>
                  </div>
                )}
                <div>
                  <p className="text-zinc-500">Booking Expenses</p>
                  <p className="font-semibold text-rose-700">{formatRupiah(bookingExpensesTotal)}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Income after direct expenses</p>
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

          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-8 flex gap-3 border-t border-border bg-white/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:-mx-8 sm:-mb-8 sm:justify-end sm:px-8 sm:pb-8">
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={action.pending} onClick={handleClose}>
              Cancel
            </Button>
            <ActionButton type="submit" className="flex-1 sm:flex-none" loading={action.pending || isSubmitting} loadingText={booking ? "Updating…" : "Saving…"}>
              {booking ? "Save changes" : "Add booking"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
