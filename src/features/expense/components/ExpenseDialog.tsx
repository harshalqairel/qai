"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS } from "@/features/payment/constants";
import { expenseSchema, ExpenseFormValues } from "@/features/expense/schema";
import { Expense, CreateExpenseInput, UpdateExpenseInput } from "@/features/expense/types";
import { Plus, XIcon } from "lucide-react";
import type { ExpenseCategory } from "@/features/expense-category/types";
import { normalizeCategoryName } from "@/features/category/utils";
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
  onCreate: (input: CreateExpenseInput) => boolean | Promise<boolean>;
  onUpdate: (input: UpdateExpenseInput) => boolean | Promise<boolean>;
  categories: ExpenseCategory[];
  onQuickCreateCategory?: (name: string) => Promise<ExpenseCategory | null>;
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
  onQuickCreateCategory,
}: ExpenseDialogProps) {
  const isEdit = expense !== null;
  const action = useActionGuard();
  const selectableCategories = categories.filter((category) => category.active || category.id === expense?.categoryId);
  const hasSelectableCategory = selectableCategories.length > 0;
  const initializedDialogRef = useRef<string | null>(null);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickCategoryError, setQuickCategoryError] = useState("");
  const [quickCategoryPending, setQuickCategoryPending] = useState(false);

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
    if (!open) {
      initializedDialogRef.current = null;
      return;
    }

    const dialogKey = expense?.id ?? "new";
    if (initializedDialogRef.current === dialogKey) return;
    initializedDialogRef.current = dialogKey;

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
    setQuickCategoryOpen(false);
    setQuickCategoryName("");
    setQuickCategoryError("");
    onClose();
  }

  async function createCategoryInline() {
    const name = quickCategoryName.trim();
    if (!onQuickCreateCategory || !name) {
      setQuickCategoryError("Enter a category name.");
      return;
    }
    if (categories.some((category) => normalizeCategoryName(category.name) === normalizeCategoryName(name))) {
      setQuickCategoryError("A category with this name already exists.");
      return;
    }

    setQuickCategoryPending(true);
    setQuickCategoryError("");
    try {
      const created = await onQuickCreateCategory(name);
      if (!created) throw new Error("CATEGORY_CREATE_FAILED");
      setValue("categoryId", created.id, { shouldDirty: true, shouldValidate: true });
      setQuickCategoryName("");
      setQuickCategoryOpen(false);
      notify.success("Expense category added and selected.");
    } catch (error) {
      setQuickCategoryError(
        error instanceof Error && error.message === "DUPLICATE_CATEGORY"
          ? "A category with this name already exists."
          : "Could not add that category. Your expense details are still here.",
      );
    } finally {
      setQuickCategoryPending(false);
    }
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <section className="space-y-5 rounded-2xl border border-border bg-slate-50/70 p-4 sm:p-5" aria-labelledby="expense-details-heading">
            <div>
              <h3 id="expense-details-heading" className="text-sm font-bold text-slate-900">Expense details</h3>
              <p className="mt-1 text-sm text-slate-500">Choose where this cost belongs, then add its details.</p>
            </div>

            <fieldset>
              <legend className="mb-2 block text-sm font-semibold text-slate-800">Expense for</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={!isBookingExpense}
                  className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    !isBookingExpense
                      ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/20"
                      : "border-border bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  onClick={() => {
                    setValue("expenseType", "Business Expense", { shouldDirty: true, shouldValidate: true });
                    setValue("bookingId", null, { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  General business
                  <span className="mt-1 block text-xs font-normal text-slate-500">Not linked to one booking</span>
                </button>
                <button
                  type="button"
                  aria-pressed={isBookingExpense}
                  className={`min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    isBookingExpense
                      ? "border-primary bg-primary/8 text-primary ring-1 ring-primary/20"
                      : "border-border bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  onClick={() => setValue("expenseType", "Booking Expense", { shouldDirty: true, shouldValidate: true })}
                >
                  Specific booking
                  <span className="mt-1 block text-xs font-normal text-slate-500">Included in that booking&apos;s profit</span>
                </button>
              </div>
            </fieldset>

            {isBookingExpense && (
              <div>
                <Label className="mb-2 block font-semibold">Booking</Label>
                <Controller
                  control={control}
                  name="bookingId"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select booking">
                          {field.value
                            ? bookingOptions.find((option) => option.id === field.value)?.label ?? "Booking not found"
                            : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
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
            )}

            <div>
            <Label className="mb-2 block font-semibold">Category</Label>
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
              <p className="mt-2 text-sm text-muted-foreground">
                No expense categories yet. Add one below to continue.
              </p>
            )}
            {errors.categoryId && (
              <p className="mt-2 text-sm text-destructive">{errors.categoryId.message}</p>
            )}
            {onQuickCreateCategory && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={quickCategoryOpen}
                  aria-controls="inline-expense-category"
                  onClick={() => {
                    setQuickCategoryOpen((value) => !value);
                    setQuickCategoryError("");
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" /> Add category
                </Button>
                {quickCategoryOpen && (
                  <div
                    id="inline-expense-category"
                    className="mt-3 space-y-3 rounded-xl border border-border bg-muted/30 p-4"
                  >
                    <div>
                      <Label htmlFor="new-expense-category" className="mb-2 block">
                        New category
                      </Label>
                      <Input
                        id="new-expense-category"
                        value={quickCategoryName}
                        onChange={(event) => setQuickCategoryName(event.target.value)}
                        placeholder="e.g. Parking"
                        autoFocus
                      />
                    </div>
                    {quickCategoryError && (
                      <p className="text-sm text-destructive" role="alert">
                        {quickCategoryError}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={quickCategoryPending}
                        onClick={createCategoryInline}
                      >
                        {quickCategoryPending ? "Adding..." : "Add Category"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={quickCategoryPending}
                        onClick={() => {
                          setQuickCategoryOpen(false);
                          setQuickCategoryError("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
              <Controller
                control={control}
                name="amount"
                render={({ field }) => (
                  <MoneyInput
                    name={field.name}
                    ref={field.ref}
                    value={Number(field.value) || 0}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    aria-invalid={Boolean(errors.amount)}
                    placeholder="0"
                  />
                )}
              />
              {errors.amount && (
                <p className="mt-2 text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-border p-4 sm:p-5" aria-labelledby="expense-payment-heading">
            <h3 id="expense-payment-heading" className="text-sm font-bold text-slate-900">Payment</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block font-semibold">Payment method</Label>
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

            <div>
              <Label className="mb-2 block font-semibold">Paid to</Label>
              <Input {...register("vendor")} placeholder="e.g. Studio or supplier" />
              <p className="mt-1.5 text-xs text-slate-500">The person or business that received the money.</p>
            </div>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-border p-4 sm:p-5" aria-labelledby="expense-notes-heading">
            <h3 id="expense-notes-heading" className="text-sm font-bold text-slate-900">Notes</h3>
            <Label className="sr-only" htmlFor="expense-notes">Notes</Label>
            <Textarea id="expense-notes" rows={3} {...register("notes")} placeholder="Add any useful context" />
          </section>

          <div className="mt-8 flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={action.pending} onClick={handleClose}>
              Cancel
            </Button>
            <ActionButton type="submit" loading={action.pending || isSubmitting} loadingText={isEdit ? "Updating…" : "Saving…"} disabled={!hasSelectableCategory || quickCategoryPending}>
              {isEdit ? "Save changes" : "Add expense"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
