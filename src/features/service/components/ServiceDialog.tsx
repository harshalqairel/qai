"use client";

import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
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
import { Plus, XIcon } from "lucide-react";

import { Service } from "@/features/service/types";
import type { ServiceCategory } from "@/features/service-category/types";
import type { CategoryInput } from "@/features/category/types";
import {
  CATEGORY_COLORS,
  categoryColorCss,
  suggestCategoryColor,
} from "@/features/category/constants";
import { normalizeCategoryName } from "@/features/category/utils";
import { formatDuration } from "@/features/service/utils/duration";
import { validateServiceVariantConfiguration } from "@/features/service/domain/serviceVariants";
import ServiceVariantEditor from "@/features/service/components/ServiceVariantEditor";
import ServiceAvailabilityEditor from "@/features/service/components/ServiceAvailabilityEditor";
import { DEFAULT_SERVICE_AVAILABILITY } from "@/features/service/domain/serviceAvailability";
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
  onQuickCreateCategory?: (input: CategoryInput) => Promise<ServiceCategory | null>;
};

const defaultValues: ServiceFormValues = {
  name: "",
  categoryId: "",
  price: 0,
  duration: 0,
  defaultSessionCount: 1,
  locationPolicy: "Client can choose",
  optionGroups: [],
  variants: [],
  availability: structuredClone(DEFAULT_SERVICE_AVAILABILITY),
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
  onQuickCreateCategory,
}: ServiceDialogProps) {
  const action = useActionGuard();
  const isEdit = service !== null;
  const selectableCategories = categories.filter((category) => category.active || category.id === service?.categoryId);
  const hasSelectableCategory = selectableCategories.length > 0;
  const initializedDialogRef = useRef<string | null>(null);
  const categoryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [categoryFocusRequest, setCategoryFocusRequest] = useState(0);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [quickCategoryName, setQuickCategoryName] = useState("");
  const [quickCategoryColor, setQuickCategoryColor] = useState<string>(() => suggestCategoryColor([]));
  const [quickCategoryError, setQuickCategoryError] = useState("");
  const [quickCategoryPending, setQuickCategoryPending] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
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
  const priceValue = useWatch({ control, name: "price" });
  const sessionCountValue = useWatch({ control, name: "defaultSessionCount" });
  const activeValue = useWatch({ control, name: "active" });

  useEffect(() => {
    if (!open) {
      initializedDialogRef.current = null;
      return;
    }

    const dialogKey = service?.id ?? "new";
    if (initializedDialogRef.current === dialogKey) return;
    initializedDialogRef.current = dialogKey;
    setQuickCategoryColor(suggestCategoryColor(categories.map((category) => category.color)));

    if (service) {
      reset({
        name: service.name,
        categoryId: service.categoryId,
        price: service.price,
        duration: service.duration,
        defaultSessionCount: service.defaultSessionCount,
        locationPolicy: service.locationPolicy ?? "Client can choose",
        optionGroups: service.optionGroups ?? [],
        variants: service.variants ?? [],
        availability: service.availability ?? structuredClone(DEFAULT_SERVICE_AVAILABILITY),
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

  useEffect(() => {
    if (!open || quickCategoryOpen || categoryFocusRequest === 0) return;
    categoryTriggerRef.current?.focus();
  }, [open, quickCategoryOpen, categoryFocusRequest]);

  function resetForm() {
    reset(defaultValues);
  }

  function handleClose() {
    resetForm();
    setCategoryFocusRequest(0);
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
      const created = await onQuickCreateCategory({ name, color: quickCategoryColor });
      if (!created) throw new Error("CATEGORY_CREATE_FAILED");
      setValue("categoryId", created.id, { shouldDirty: true, shouldValidate: true });
      setQuickCategoryName("");
      setCategoryFocusRequest((request) => request + 1);
      setQuickCategoryOpen(false);
      setQuickCategoryColor(suggestCategoryColor([...categories.map((category) => category.color), created.color]));
      notify.success("Service category added and selected.");
    } catch (error) {
      setQuickCategoryError(
        error instanceof Error && error.message === "DUPLICATE_CATEGORY"
          ? "A category with this name already exists."
          : "Could not add that category. Your service details are still here.",
      );
    } finally {
      setQuickCategoryPending(false);
    }
  }

  async function onSubmit(values: ServiceFormValues) {
    const optionIssue = validateServiceVariantConfiguration(values.optionGroups, values.variants);
    if (optionIssue) {
      notify.error(optionIssue);
      return;
    }
    const serviceData: Service = {
      id: service?.id ?? crypto.randomUUID(),
      name: values.name.trim(),
      categoryId: values.categoryId,
      price: values.price,
      duration: values.duration,
      defaultSessionCount: values.defaultSessionCount,
      locationPolicy: values.locationPolicy,
      optionGroups: values.optionGroups,
      variants: values.variants,
      availability: values.availability,
      description: values.description.trim(),
      active: values.active,
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
              Service category
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
                  <SelectTrigger ref={categoryTriggerRef} className="w-full">
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
              <p className="mt-2 text-sm text-muted-foreground">No service categories yet. Add one below to continue.</p>
            )}

            {errors.categoryId && (
              <p className="mt-2 text-sm text-destructive">
                {errors.categoryId.message}
              </p>
            )}
            {onQuickCreateCategory && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={quickCategoryOpen}
                  aria-controls="inline-service-category"
                  onClick={() => {
                    setQuickCategoryOpen((value) => !value);
                    setQuickCategoryError("");
                  }}
                >
                  <Plus className="size-4" aria-hidden="true" /> Add category
                </Button>
                {quickCategoryOpen && (
                  <div id="inline-service-category" className="mt-3 space-y-4 rounded-xl border border-border bg-muted/30 p-4">
                    <div>
                      <Label htmlFor="new-service-category" className="mb-2 block">Category name</Label>
                      <Input
                        id="new-service-category"
                        value={quickCategoryName}
                        onChange={(event) => {
                          setQuickCategoryName(event.target.value);
                          setQuickCategoryError("");
                        }}
                        placeholder="e.g. Bridal Makeup"
                        autoFocus
                      />
                    </div>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">Color</legend>
                      <div className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                        {CATEGORY_COLORS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            aria-label={option.label}
                            aria-pressed={quickCategoryColor === option.value}
                            onClick={() => setQuickCategoryColor(option.value)}
                            className={`flex size-10 items-center justify-center rounded-lg border bg-card sm:size-11 ${quickCategoryColor === option.value ? "border-primary ring-2 ring-ring/30" : "border-border"}`}
                          >
                            <span className="size-5 rounded-full" style={{ backgroundColor: categoryColorCss(option.value) }} aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    {quickCategoryError && <p className="text-sm text-destructive" role="alert">{quickCategoryError}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={quickCategoryPending} onClick={createCategoryInline}>
                        {quickCategoryPending ? "Adding..." : "Add category"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={quickCategoryPending}
                        onClick={() => {
                          setCategoryFocusRequest((request) => request + 1);
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

          <div>
            <Label className="mb-2 block font-semibold">
              Service name
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
                Typical duration
              </Label>

              <div className="flex items-center gap-2">
                <Controller control={control} name="duration" render={({ field }) => <EditableNumberInput name={field.name} ref={field.ref} min={1} value={Number(field.value) || 0} emptyValue={0} onBlur={field.onBlur} onValueChange={field.onChange} />} />
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
            <Label className="mb-2 block font-semibold">Usual number of schedules</Label>
            <Controller control={control} name="defaultSessionCount" render={({ field }) => <EditableNumberInput name={field.name} ref={field.ref} min={1} max={50} inputMode="numeric" value={Number(field.value) || 0} emptyValue={0} onBlur={field.onBlur} onValueChange={field.onChange} />} />
            <p className="mt-2 text-sm text-muted-foreground">
              How many separate dates or time slots does this service usually need? You can change this for each booking.
            </p>
            {errors.defaultSessionCount && (
              <p className="mt-2 text-sm text-destructive">{errors.defaultSessionCount.message}</p>
            )}
          </div>

          <Controller
            control={control}
            name="active"
            render={({ field }) => (
              <label className="flex min-h-20 cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-muted/25 p-4">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">Service active</span>
                  <span id="service-active-help" className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {activeValue
                      ? "Available for new bookings and applicable public surfaces."
                      : "Hidden from new bookings and public availability. Existing bookings and history are preserved."}
                  </span>
                </span>
                <span className="relative mt-0.5 inline-flex h-6 w-11 shrink-0">
                  <input
                    ref={field.ref}
                    name={field.name}
                    type="checkbox"
                    role="switch"
                    aria-describedby="service-active-help"
                    checked={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="absolute inset-0 rounded-full bg-muted-foreground/35 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2" aria-hidden="true" />
                  <span className="absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" aria-hidden="true" />
                </span>
              </label>
            )}
          />

          <div>
            <Label className="mb-2 block font-semibold">Service location</Label>
            <Controller
              control={control}
              name="locationPolicy"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Choose where this service happens" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Business/studio only">Business/studio only</SelectItem>
                    <SelectItem value="Client location only">Client location only</SelectItem>
                    <SelectItem value="Client can choose">Client can choose</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="mt-2 text-sm text-muted-foreground">This controls which location choices clients see in your Space.</p>
          </div>

          <Controller
            control={control}
            name="optionGroups"
            render={({ field: groupsField }) => (
              <Controller
                control={control}
                name="variants"
                render={({ field: variantsField }) => (
                  <ServiceVariantEditor
                    optionGroups={groupsField.value ?? []}
                    variants={variantsField.value ?? []}
                    basePrice={Number(priceValue) || 0}
                    baseDuration={Number(durationValue) || 60}
                    baseSessionCount={Number(sessionCountValue) || 1}
                    onOptionGroupsChange={groupsField.onChange}
                    onVariantsChange={variantsField.onChange}
                  />
                )}
              />
            )}
          />

          <Controller control={control} name="availability" render={({ field }) => <ServiceAvailabilityEditor value={field.value} onChange={field.onChange} />} />

          <div>
            <Label className="mb-2 block font-semibold">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
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
              disabled={action.pending || quickCategoryPending}
              onClick={handleClose}
            >
              Cancel
            </Button>

            <ActionButton
              type="submit"
              loading={action.pending || isSubmitting}
              loadingText={isEdit ? "Updating…" : "Saving…"}
              disabled={!hasSelectableCategory || quickCategoryPending}
            >
              {isEdit
                ? "Save changes"
                : "Add service"}
            </ActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}
