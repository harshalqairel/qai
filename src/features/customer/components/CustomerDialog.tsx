"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { CreateCustomerInput, Customer, UpdateCustomerInput } from "@/features/customer/types";
import { customerSchema, CustomerFormValues } from "@/features/customer/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ActionButton from "@/components/system/ActionButton";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";
import { XIcon } from "lucide-react";
import { clientSecondaryIdentity, findClientMatches } from "@/features/customer/domain/clientIdentity";

type CustomerDialogProps = {
  open: boolean;
  customer: Customer | null;
  onClose: () => void;
  onCreate: (input: CreateCustomerInput) => boolean | Promise<boolean>;
  onUpdate: (input: UpdateCustomerInput) => boolean | Promise<boolean>;
  customers?: Customer[];
  onUseExisting?: (customer: Customer) => void;
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
  customers = [],
  onUseExisting,
}: CustomerDialogProps) {
  const action = useActionGuard();
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues,
    mode: "onTouched",
  });
  const [allowSeparate, setAllowSeparate] = useState(false);
  const identity = useWatch({ control: form.control });
  const matches = useMemo(() => customer ? [] : findClientMatches(identity, customers).slice(0, 4), [customer, identity, customers]);

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
    const timer = window.setTimeout(() => setAllowSeparate(false), 0);
    return () => window.clearTimeout(timer);
  }, [open, customer, form]);

  function handleClose() {
    form.reset(defaultValues);
    setAllowSeparate(false);
    onClose();
  }

  async function onSubmit(values: CustomerFormValues) {
    if (customer) {
      const updateInput: UpdateCustomerInput = {
        id: customer.id,
        ...values,
      };
      const succeeded = await action.run(() => onUpdate(updateInput));
      if (!succeeded) {
        notify.error("Couldn't save this client. Check the highlighted fields and try again.");
        return;
      }
      notify.success("Client updated.");
      handleClose();
      return;
    }

    if (matches.some((match) => match.strong) && !allowSeparate) {
      notify.error("A client with matching contact details already exists. Use that client, or confirm that this is a separate person.");
      return;
    }
    const succeeded = await action.run(() => onCreate(values));
    if (!succeeded) {
      notify.error("Couldn't save this client. Check the highlighted fields and try again.");
      return;
    }
    notify.success("Client added.");
    handleClose();
  }

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={() => !action.pending && handleClose()}
    >
      <div
        className="h-dvh w-full max-w-xl overflow-y-auto border-l border-border bg-white p-5 shadow-xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="dialog-title">
              {customer ? "Edit client" : "Add client"}
            </h2>

            <p className="mt-2 text-slate-500">
              {customer ? "Update client details." : "Add a client to use in bookings."}
            </p>
          </div>

          <Button type="button" variant="ghost" size="icon" disabled={action.pending} onClick={handleClose} aria-label="Close client form">
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div>
            <Label className="mb-2 block font-semibold">Name</Label>
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

          {!customer && matches.length > 0 && (
            <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="possible-clients-heading">
              <h3 id="possible-clients-heading" className="text-sm font-semibold text-amber-950">Possible existing clients</h3>
              <p className="text-xs leading-5 text-amber-900">Names may be shared. Contact details are weighted more strongly.</p>
              {matches.map((match) => (
                <button key={match.customer.id} type="button" className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-left" onClick={() => onUseExisting?.(match.customer)}>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{match.customer.name}</span><span className="block truncate text-xs text-muted-foreground">{clientSecondaryIdentity(match.customer) || "Matching name"}</span></span>{onUseExisting && <span className="shrink-0 text-xs font-semibold text-primary">Use existing</span>}
                </button>
              ))}
              {matches.some((match) => match.strong) && <label className="flex min-h-11 items-center gap-2 text-xs text-amber-950"><input type="checkbox" checked={allowSeparate} onChange={(event) => setAllowSeparate(event.target.checked)} />Create a separate client with shared contact details</label>}
            </section>
          )}

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
            <Button type="button" variant="outline" disabled={action.pending} onClick={handleClose}>
              Cancel
            </Button>

            <ActionButton type="submit" loading={action.pending} loadingText={customer ? "Updating…" : "Saving…"}>
              {customer ? "Save changes" : "Add client"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
