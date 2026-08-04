"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CreateCustomerInput, Customer, UpdateCustomerInput } from "@/features/customer/types";
import { customerSchema, CustomerFormValues } from "@/features/customer/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type CustomerDialogProps = {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onCreate: (input: CreateCustomerInput) => void;
  onUpdate: (input: UpdateCustomerInput) => void;
};

const defaultValues: CustomerFormValues = {
  name: "",
  phone: "",
  instagram: "",
  email: "",
  notes: "",
};

export default function CustomerDialog({
  open,
  customer,
  onClose,
  onCreate,
  onUpdate,
}: CustomerDialogProps) {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (customer) {
      form.reset({
        name: customer.name,
        phone: customer.phone,
        instagram: customer.instagram,
        email: customer.email,
        notes: customer.notes,
      });
      return;
    }

    form.reset(defaultValues);
  }, [open, customer, form]);

  function handleClose() {
    form.reset(defaultValues);
    onClose();
  }

  function onSubmit(values: CustomerFormValues) {
    if (customer) {
      const updateInput: UpdateCustomerInput = {
        id: customer.id,
        ...values,
      };
      onUpdate(updateInput);
      return;
    }

    onCreate(values);
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="dialog-title">
              {customer ? "Edit Customer" : "Add Customer"}
            </h2>

            <p className="mt-2 text-slate-500">
              {customer ? "Update your customer details." : "Create a new customer."}
            </p>
          </div>

          <Button type="button" variant="ghost" size="icon" onClick={handleClose}>
            ✕
          </Button>
        </div>

        <form
          onSubmit={form.handleSubmit((values) => {
            onSubmit(values);
            form.reset(defaultValues);
          })}
          className="space-y-6"
        >
          <div>
            <Label className="mb-2 block font-semibold">Customer Name</Label>
            <Input {...form.register("name")} className="w-full" />
            {form.formState.errors.name && (
              <p className="mt-2 text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Phone</Label>
            <Input {...form.register("phone")} className="w-full" />
            {form.formState.errors.phone && (
              <p className="mt-2 text-sm text-destructive">
                {form.formState.errors.phone.message}
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Instagram</Label>
            <Input {...form.register("instagram")} className="w-full" />
            {form.formState.errors.instagram && (
              <p className="mt-2 text-sm text-destructive">
                {form.formState.errors.instagram.message}
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Email</Label>
            <Input {...form.register("email")} className="w-full" />
            {form.formState.errors.email && (
              <p className="mt-2 text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Notes</Label>
            <Textarea {...form.register("notes")} rows={5} />
            {form.formState.errors.notes && (
              <p className="mt-2 text-sm text-destructive">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>

          <div className="mt-10 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>

            <Button type="submit">
              {customer ? "Update Customer" : "Save Customer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
