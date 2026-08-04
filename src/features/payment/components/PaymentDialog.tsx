"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Controller } from "react-hook-form";
import { PAYMENT_METHODS } from "../constants";
import { paymentSchema, PaymentFormValues } from "../schema";
import { CreatePaymentInput, Payment, UpdatePaymentInput } from "../types";
import ActionButton from "@/components/system/ActionButton";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";
import { XIcon } from "lucide-react";

type PaymentDialogProps = {
  open: boolean;
  bookingId: string | null;
  payment?: Payment | null;
  onClose: () => void;
  onCreate: (input: CreatePaymentInput) => boolean;
  onUpdate?: (input: UpdatePaymentInput) => boolean;
};

const defaultValues: PaymentFormValues = {
  bookingId: "",
  date: "",
  amount: 0,
  method: "Transfer",
  notes: "",
};

export default function PaymentDialog({ open, bookingId, payment, onClose, onCreate, onUpdate }: PaymentDialogProps) {
  const isEdit = !!payment;
  const action = useActionGuard();

  const form = useForm<z.input<typeof paymentSchema>, undefined, PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open) return;

    if (payment) {
      form.reset({
        bookingId: payment.bookingId,
        date: payment.date,
        amount: payment.amount,
        method: payment.method,
        notes: payment.notes,
      });
    } else {
      form.reset({
        ...defaultValues,
        bookingId: bookingId ?? "",
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, bookingId, payment, form]);

  function handleClose() {
    form.reset(defaultValues);
    onClose();
  }

  async function onSubmit(values: PaymentFormValues) {
    const succeeded = await action.run(() => isEdit && payment
      ? onUpdate?.({ id: payment.id, ...values }) ?? false
      : onCreate(values));
    if (!succeeded) {
      notify.error("Could not save the payment. Try again.");
      return;
    }
    notify.success(isEdit ? "Payment updated." : "Payment recorded.");
    handleClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => !action.pending && handleClose()}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">{isEdit ? "Edit Payment" : "Add Payment"}</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isEdit ? "Update this payment transaction." : "Record one payment transaction."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={action.pending} onClick={handleClose} aria-label="Close payment form">
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <Label className="mb-2 block font-semibold">Payment Date</Label>
            <Input type="date" {...form.register("date")} />
            {form.formState.errors.date && <p className="mt-2 text-sm text-destructive">{form.formState.errors.date.message}</p>}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Amount</Label>
            <Input type="number" min={1} {...form.register("amount", { valueAsNumber: true })} />
            {form.formState.errors.amount && <p className="mt-2 text-sm text-destructive">{form.formState.errors.amount.message}</p>}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Payment Method</Label>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Notes</Label>
            <Textarea rows={3} {...form.register("notes")} />
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <Button type="button" variant="outline" disabled={action.pending} onClick={handleClose}>
              Cancel
            </Button>
            <ActionButton type="submit" loading={action.pending} loadingText={isEdit ? "Updating…" : "Saving…"}>{isEdit ? "Update Payment" : "Save Payment"}</ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
