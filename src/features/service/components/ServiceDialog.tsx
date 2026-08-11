"use client";

import { useEffect } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ActionButton from "@/components/system/ActionButton";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";
import { XIcon } from "lucide-react";

import { Service } from "@/features/service/types";
import type { ServiceCategory } from "@/features/service-category/types";
import { formatDuration } from "@/features/service/utils/duration";
import {
  serviceSchema,
  ServiceFormValues,
} from "@/features/service/schema";

type ServiceDialogProps = {
  open: boolean;
  service: Service | null;
  onClose: () => void;
  onCreate: (service: Service) => boolean | Promise<boolean>;
  onUpdate: (service: Service) => boolean | Promise<boolean>;
  categories: ServiceCategory[];
};

const defaultValues: ServiceFormValues = {
  name: "",
  categoryId: "",
  price: 0,
  duration: 0,
  defaultSessionCount: 1,
  description: "",
  active: true,
};

export default function ServiceDialog({
  open,
  service,
  onClose,
  onCreate,
  onUpdate,
  categories,
}: ServiceDialogProps) {
  const action = useActionGuard();
  const isEdit = service !== null;
  const selectableCategories = categories.filter((category) => category.active || category.id === service?.categoryId);
  const hasSelectableCategory = selectableCategories.length > 0;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<
    z.input<typeof serviceSchema>,
    undefined,
    ServiceFormValues
  >({
    resolver: zodResolver(serviceSchema),
    defaultValues,
    mode: "onTouched",
  });
  const durationValue = useWatch({ control, name: "duration" });

  useEffect(() => {
    if (!open) return;

    if (service) {
      reset({
        name: service.name,
        categoryId: service.categoryId,
        price: service.price,
        duration: service.duration,
        defaultSessionCount: service.defaultSessionCount,
        description: service.description,
        active: service.active,
      });

      return;
    }

    reset({
      ...defaultValues,
      categoryId: categories.find((category) => category.active)?.id ?? "",
    });
  }, [open, service, reset, categories]);

  function resetForm() {
    reset(defaultValues);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function onSubmit(values: ServiceFormValues) {
    const serviceData: Service = {
      id: service?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      categoryId: values.categoryId,
      price: values.price,
      duration: values.duration,
      defaultSessionCount: values.defaultSessionCount,
      description: values.description.trim(),
      active: service?.active ?? true,
    };

    const succeeded = await action.run(() => isEdit ? onUpdate(serviceData) : onCreate(serviceData));
    if (!succeeded) {
      notify.error("Could not save the service. Try again.");
      return;
    }
    notify.success(isEdit ? "Service updated." : "Service added.");
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
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="dialog-title">
              {isEdit ? "Edit Service" : "Add Service"}
            </h2>

            <p className="mt-2 text-slate-500">
              {isEdit
                ? "Update your service."
                : "Create a new service."}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={action.pending}
            onClick={handleClose}
            aria-label="Close service form"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div>
            <Label className="mb-2 block font-semibold">
              Service Category
            </Label>

            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!hasSelectableCategory}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category">
                      {field.value
                        ? categories.find((category) => category.id === field.value)?.name ?? "Category not found"
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    {selectableCategories.map((item) => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        disabled={!item.active}
                      >
                        {item.name}{!item.active ? " (Hidden)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {!hasSelectableCategory && (
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-muted-foreground">No service categories yet.</p>
                <button
                  type="button"
                  className="font-medium text-[var(--status-info)] hover:underline"
                  onClick={() => window.location.assign("/settings?section=service-categories")}
                >
                  Add a service category
                </button>
                <p className="text-muted-foreground">Add a service category before saving this service.</p>
              </div>
            )}

            {errors.categoryId && (
              <p className="mt-2 text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            )}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">
              Service Name
            </Label>

            <Input
              {...register("name")}
              className="w-full"
            />

            {errors.name && (
              <p className="mt-2 text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <Label className="mb-2 block font-semibold">
                Price
              </Label>

              <Controller
                control={control}
                name="price"
                render={({ field }) => (
                  <MoneyInput
                    name={field.name}
                    ref={field.ref}
                    value={Number(field.value) || 0}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    aria-invalid={Boolean(errors.price)}
                    placeholder="0"
                  />
                )}
              />

              {errors.price && (
                <p className="mt-2 text-sm text-destructive">
                  {errors.price.message}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-2 block font-semibold">
                Duration
              </Label>

              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  {...register("duration", { valueAsNumber: true })}
                />
                <span className="shrink-0 text-sm text-muted-foreground">minutes</span>
              </div>
              {Number(durationValue) > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">{formatDuration(Number(durationValue))}</p>
              )}

              {errors.duration && (
                <p className="mt-2 text-sm text-destructive">
                  {errors.duration.message}
                </p>
              )}
            </div>
          </div>

          <div>
            <Label className="mb-2 block font-semibold">Default Session Count</Label>
            <Input
              type="number"
              min={1}
              max={50}
              inputMode="numeric"
              {...register("defaultSessionCount", { valueAsNumber: true })}
            />
            <p className="mt-2 text-sm text-muted-foreground">
              New bookings start with this many editable schedules. Users can add or remove them.
            </p>
            {errors.defaultSessionCount && (
              <p className="mt-2 text-sm text-destructive">{errors.defaultSessionCount.message}</p>
            )}
          </div>

          <div>
            <Label className="mb-2 block font-semibold">
              Description
            </Label>

            <Textarea
              rows={5}
              {...register("description")}
            />

            {errors.description && (
              <p className="mt-2 text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          <div className="mt-10 flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={action.pending}
              onClick={handleClose}
            >
              Cancel
            </Button>

            <ActionButton
              type="submit"
              loading={action.pending || isSubmitting}
              loadingText={isEdit ? "Updating…" : "Saving…"}
              disabled={!hasSelectableCategory}
            >
              {isEdit
                ? "Update Service"
                : "Save Service"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
