"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_TYPES } from "@/features/expense/constants";
import { PAYMENT_METHODS } from "@/features/payment/constants";
import { expenseSchema, ExpenseFormValues } from "@/features/expense/schema";
import { Expense, CreateExpenseInput, UpdateExpenseInput } from "@/features/expense/types";
import { XIcon } from "lucide-react";
import type { ExpenseCategory } from "@/features/expense-category/types";
import ActionButton from "@/components/system/ActionButton";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";

type BookingOption = { id: string; label: string };

type ExpenseDialogProps = {
  open: boolean;
  expense: Expense | null;
  bookingOptions: BookingOption[];
  initialValues?: Partial<ExpenseFormValues>;
  onClose: () => void;
  onCreate: (input: CreateExpenseInput) => boolean;
  onUpdate: (input: UpdateExpenseInput) => boolean;
  categories: ExpenseCategory[];
};

const defaultValues: ExpenseFormValues = {
  date: "",
  categoryId: "",
  amount: 0,
  paymentMethod: "Cash",
  expenseType: "Business Expense",
  bookingId: null,
  vendor: "",
  notes: "",
};

export default function ExpenseDialog({
  open,
  expense,
  bookingOptions,
  initialValues,
  onClose,
  onCreate,
  onUpdate,
  categories,
}: ExpenseDialogProps) {
  const isEdit = expense !== null;
  const action = useActionGuard();
  const selectableCategories = categories.filter((category) => category.active || category.id === expense?.categoryId);
  const hasSelectableCategory = selectableCategories.length > 0;

  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof expenseSchema>, undefined, ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open) return;

    if (expense) {
      reset({
        date: expense.date,
        categoryId: expense.categoryId,
        amount: expense.amount,
        paymentMethod: expense.paymentMethod,
        expenseType: expense.expenseType,
        bookingId: expense.bookingId,
        vendor: expense.vendor,
        notes: expense.notes,
      });
    } else {
      reset({
        ...defaultValues,
        ...initialValues,
        date: new Date().toISOString().slice(0, 10),
        categoryId: categories.find((category) => category.active)?.id ?? "",
      });
    }
  }, [open, expense, initialValues, reset, categories]);

  const expenseType = watch("expenseType");
  const isBookingExpense = expenseType === "Booking Expense";

  function handleClose() {
    reset(defaultValues);
    onClose();
  }

  async function onSubmit(values: ExpenseFormValues) {
    const input = {
      ...values,
      bookingId: isBookingExpense ? values.bookingId : null,
    };

    const succeeded = await action.run(() => isEdit && expense ? onUpdate({ id: expense.id, ...input }) : onCreate(input));
    if (!succeeded) {
      notify.error("Could not save the expense. Try again.");
      return;
    }
    notify.success(isEdit ? "Expense updated." : "Expense added.");
    handleClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={() => !action.pending && handleClose()}
    >
      <div
        className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="dialog-title">
              {isEdit ? "Edit Expense" : "Add Expense"}
            </h2>
            <p className="mt-2 text-slate-500">
              {isEdit ? "Update expense details." : "Record a new expense."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={handleClose} aria-label="Close expense form">
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Expense Type */}
          <div>
            <Label className="mb-2 block font-semibold">Expense Type</Label>
            <Controller
              control={control}
              name="expenseType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Related Booking (optional)</Label>
            <Controller
              control={control}
              name="bookingId"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(value) => {
                    const bookingId = value === "none" ? null : value;
                    field.onChange(bookingId);
                    setValue("expenseType", bookingId ? "Booking Expense" : "Business Expense");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No related booking">
                      {field.value
                        ? bookingOptions.find((option) => option.id === field.value)?.label ?? "Booking not found"
                        : "No related booking"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No related booking</SelectItem>
                    {bookingOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.bookingId && (
              <p className="mt-2 text-sm text-destructive">{errors.bookingId.message}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <Label className="mb-2 block font-semibold">Expense Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!hasSelectableCategory}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category">
                      {field.value
                        ? categories.find((category) => category.id === field.value)?.name ?? "Category not found"
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {selectableCategories.map((category) => (
                        <SelectItem
                          key={category.id}
                          value={category.id}
                          disabled={!category.active}
                        >
                          {category.name}{!category.active ? " (Hidden)" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!hasSelectableCategory && (
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-muted-foreground">No expense categories yet.</p>
                <button
                  type="button"
                  className="font-medium text-[var(--status-info)] hover:underline"
                  onClick={() => window.location.assign("/settings?section=expense-categories")}
                >
                  Add an expense category
                </button>
                <p className="text-muted-foreground">Add an expense category before saving this expense.</p>
              </div>
            )}
            {errors.categoryId && (
              <p className="mt-2 text-sm text-destructive">{errors.categoryId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Date */}
            <div>
              <Label className="mb-2 block font-semibold">Date</Label>
              <Input type="date" {...register("date")} />
              {errors.date && (
                <p className="mt-2 text-sm text-destructive">{errors.date.message}</p>
              )}
            </div>

            {/* Amount */}
            <div>
              <Label className="mb-2 block font-semibold">Amount</Label>
              <Input type="number" min={1} {...register("amount", { valueAsNumber: true })} />
              {errors.amount && (
                <p className="mt-2 text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Payment Method */}
            <div>
              <Label className="mb-2 block font-semibold">Payment Method</Label>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Vendor */}
            <div>
              <Label className="mb-2 block font-semibold">Vendor (optional)</Label>
              <Input {...register("vendor")} placeholder="e.g. Tokopedia" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="mb-2 block font-semibold">Notes</Label>
            <Textarea rows={3} {...register("notes")} />
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={action.pending} onClick={handleClose}>
              Cancel
            </Button>
            <ActionButton type="submit" loading={action.pending || isSubmitting} loadingText={isEdit ? "Updating…" : "Saving…"} disabled={!hasSelectableCategory}>
              {isEdit ? "Update Expense" : "Save Expense"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
