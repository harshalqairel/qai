"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { Service } from "@/features/service/types";
import type { ServiceCategory } from "@/features/service-category/types";
import {
  serviceSchema,
  ServiceFormValues,
} from "@/features/service/schema";

type ServiceDialogProps = {
  open: boolean;
  service: Service | null;
  onClose: () => void;
  onCreate: (service: Service) => void;
  onUpdate: (service: Service) => void;
  categories: ServiceCategory[];
};

const defaultValues: ServiceFormValues = {
  name: "",
  categoryId: "",
  price: 0,
  duration: 0,
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
  const isEdit = service !== null;

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

  useEffect(() => {
    if (!open) return;

    if (service) {
      reset({
        name: service.name,
        categoryId: service.categoryId,
        price: service.price,
        duration: service.duration,
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

  function onSubmit(values: ServiceFormValues) {
    const serviceData: Service = {
      id: service?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      categoryId: values.categoryId,
      price: values.price,
      duration: values.duration,
      description: values.description.trim(),
      active: service?.active ?? true,
    };

    if (isEdit) {
      onUpdate(serviceData);
    } else {
      onCreate(serviceData);
    }

    resetForm();
  }

  if (!open) return null;

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
            onClick={handleClose}
          >
            ✕
          </Button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div>
            <Label className="mb-2 block font-semibold">
              Category
            </Label>

            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category">
                      {field.value
                        ? categories.find((category) => category.id === field.value)?.name ?? "Category not found"
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>

                  <SelectContent>
                    {categories
                      .filter((item) => item.active || item.id === service?.categoryId)
                      .map((item) => (
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

              <Input
                type="number"
                {...register("price", {
                  valueAsNumber: true,
                })}
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

              <Input
                type="number"
                {...register("duration", {
                  valueAsNumber: true,
                })}
              />

              {errors.duration && (
                <p className="mt-2 text-sm text-destructive">
                  {errors.duration.message}
                </p>
              )}
            </div>
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
              onClick={handleClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isEdit
                ? "Update Service"
                : "Save Service"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
