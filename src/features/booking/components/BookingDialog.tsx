"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Booking, BookingAdditionalChargeInput, CreateBookingCommand } from "@/features/booking/types";
import { bookingSchema, BookingFormValues } from "@/features/booking/schema";
import { doesBookingEndNextDay } from "@/features/booking/utils/bookingDateRange";
import { instantParts, sessionToFormValues } from "@/features/booking/utils/bookingSessions";
import { Service } from "@/features/service/types";
import type { CreateServiceInput } from "@/features/service/types";
import type { CreateCustomerInput, Customer } from "@/features/customer/types";
import { customerSchema } from "@/features/customer/schema";
import type { ServiceCategory } from "@/features/service-category/types";
import { InitialPaymentInput, Payment } from "@/features/payment/types";
import { PAYMENT_METHODS } from "@/features/payment/constants";
import { initialPaymentSchemaForBooking } from "@/features/payment/schema";
import { formatRupiah, getPaymentLabel } from "@/features/payment/utils/paymentCalculations";
import { Expense } from "@/features/expense/types";
import { getBookingExpenses } from "@/features/expense/utils/expenseAggregations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import ActionButton from "@/components/system/ActionButton";
import DeleteAction from "@/components/system/DeleteAction";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";
import { isValidationModeEnabled } from "@/lib/supabase/config";
import { ArrowLeft, Copy, Info, Plus, Trash2, XIcon } from "lucide-react";
import BookingCreationStart from "@/features/booking/components/BookingCreationStart";
import {
  createAdditionalChargeCategoryPersistent,
  getAdditionalChargeCategories,
  loadAdditionalChargeCategories,
  type AdditionalChargeCategory,
} from "@/features/booking/domain/additionalChargeCategories";
import { QuestionnaireFields, HistoricalQuestionnaireResponses } from "@/features/booking-questionnaire/QuestionnaireFields";
import { DEFAULT_BOOKING_QUESTIONNAIRE, questionsForService, validateQuestionnaireResponses, type BookingQuestion, type BookingQuestionFileAnswer, type BookingQuestionResponse, type BookingQuestionnaireDefinition } from "@/features/booking-questionnaire/questionnaire";
import { loadBookingQuestionnaire } from "@/features/booking-questionnaire/questionnaireRepository";
import { validationClient } from "@/features/qai-page/validation";
import { clientSearchText, clientSecondaryIdentity, findClientMatches } from "@/features/customer/domain/clientIdentity";
import { defaultServiceVariant, snapshotServiceSelection } from "@/features/service/domain/serviceVariants";

type BookingDialogProps = {
  open: boolean;
  booking: Booking | null;
  initialValues?: Partial<BookingFormValues>;
  customers: Customer[];
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
  onUpdate: (input: BookingFormValues & { id: string; additionalCharges?: BookingAdditionalChargeInput[] }) => boolean | Promise<boolean>;
  onAddPaymentClick: (bookingId: string, remainingAmount: number) => void;
  onEditPaymentClick: (payment: Payment) => void;
  onDeletePayment: (id: string) => boolean | Promise<boolean>;
};

const defaultValues: BookingFormValues = {
  customerId: "",
  serviceId: "",
  serviceSnapshot: null,
  sessions: [{ label: "", date: "", startTime: "", endTime: "", location: "", notes: "" }],
  servicePrice: 0,
  questionnaireResponses: [],
  bookingStatus: "Scheduled",
  fullPaymentDueDate: "",
  notes: "",
};

function withSessionIds(values: BookingFormValues): BookingFormValues {
  return {
    ...values,
    sessions: values.sessions.map((session) => ({ ...session, id: session.id?.trim() || crypto.randomUUID() })),
  };
}

function suggestedEndTime(startTime: string, duration: number): string {
  if (!startTime) return "";
  const [hours, minutes] = startTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  const total = (hours * 60 + minutes + Math.max(1, duration)) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

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
  const [quickCustomer, setQuickCustomer] = useState({ name: "", phone: "", instagram: "", email: "" });
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
  const [startMode, setStartMode] = useState<"choose" | "manual" | "paste" | "template">("choose");
  const [parsedReviewNotice, setParsedReviewNotice] = useState("");
  const [chargeCategories, setChargeCategories] = useState<AdditionalChargeCategory[]>(getAdditionalChargeCategories);
  const [additionalCharges, setAdditionalCharges] = useState<BookingAdditionalChargeInput[]>([]);
  const [addingCharge, setAddingCharge] = useState(false);
  const [chargeDraft, setChargeDraft] = useState({ categoryId: "", sessionId: "", amount: 0, description: "" });
  const [newChargeCategoryOpen, setNewChargeCategoryOpen] = useState(false);
  const [newChargeCategoryName, setNewChargeCategoryName] = useState("");
  const [questionnaire, setQuestionnaire] = useState<BookingQuestionnaireDefinition>(DEFAULT_BOOKING_QUESTIONNAIRE);
  const [questionnaireResponses, setQuestionnaireResponses] = useState<BookingQuestionResponse[]>([]);
  const [questionnaireErrors, setQuestionnaireErrors] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [allowSeparateClient, setAllowSeparateClient] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (booking) {
      setStartMode("manual");
      setParsedReviewNotice("");
      setAdditionalCharges((booking.additionalCharges ?? []).map((charge) => ({
        id: charge.id,
        sessionId: charge.sessionId,
        categoryId: charge.categoryId,
        categoryName: charge.categoryName,
        description: charge.description,
        amount: charge.amount,
      })));
      setInitialPaymentOpen(false);
      setInitialPaymentErrors({});
      setQuestionnaireResponses(booking.questionnaireResponses ?? []);
      setQuestionnaireErrors({});
      setSelectedVariantId(booking.serviceSnapshot?.variantId ?? null);
      reset(withSessionIds({
        customerId: booking.customerId,
        serviceId: booking.serviceId,
        serviceSnapshot: booking.serviceSnapshot ?? null,
        sessions: booking.sessions.map((session) => sessionToFormValues(session, timezone)),
        servicePrice: booking.servicePrice,
        questionnaireResponses: booking.questionnaireResponses ?? [],
        bookingStatus: booking.bookingStatus,
        fullPaymentDueDate: booking.fullPaymentDueDate,
        notes: booking.notes,
      }));
      return;
    }

    lastDefaultedServiceId.current = null;
    creationRequestId.current = crypto.randomUUID();
    setStartMode(initialValues ? "manual" : "choose");
    setParsedReviewNotice("");
    setAdditionalCharges([]);
    setAddingCharge(false);
    setQuickCustomerOpen(false);
    setQuickCustomer({ name: "", phone: "", instagram: "", email: "" });
    setInitialPaymentOpen(false);
    setInitialPayment(defaultInitialPayment(timezone));
    setInitialPaymentErrors({});
    setQuestionnaireResponses(initialValues?.questionnaireResponses ?? []);
    setQuestionnaireErrors({});
    setSelectedVariantId(initialValues?.serviceSnapshot?.variantId ?? null);
    setAllowSeparateClient(false);
    reset(withSessionIds({
      ...defaultValues,
      ...(initialValues ?? {}),
      sessions: initialValues?.sessions ?? defaultValues.sessions,
    }));
  }, [open, booking, initialValues, reset, timezone]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadBookingQuestionnaire().then((loaded) => { if (active) setQuestionnaire(loaded); }).catch(() => notify.error("Could not load booking questions."));
    return () => { active = false; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void loadAdditionalChargeCategories().then((loaded) => {
      if (!active) return;
      setChargeCategories(loaded);
      setChargeDraft((current) => ({ ...current, categoryId: loaded.some((category) => category.id === current.categoryId) ? current.categoryId : loaded[0]?.id ?? "" }));
    }).catch(() => notify.error("Could not load additional charge categories."));
    return () => { active = false; };
  }, [open]);

  const selectedServiceId = watch("serviceId");
  const servicePriceValue = watch("servicePrice");
  const selectedService = services.find((service) => service.id === selectedServiceId);
  const selectedVariant = selectedService?.variants?.find((variant) => variant.id === selectedVariantId && variant.active) ?? null;
  const selectedServiceSnapshot = selectedService ? snapshotServiceSelection(selectedService, selectedVariant) : null;
  const activeQuestions = questionsForService(questionnaire, selectedServiceId);
  const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));
  const historicalResponses = questionnaireResponses.filter((response) => !activeQuestionIds.has(response.questionId));
  const bookingPayments = booking ? payments.filter((payment) => payment.bookingId === booking.id) : [];
  const quickCustomerMatches = useMemo(() => findClientMatches(quickCustomer, customers).slice(0, 4), [quickCustomer, customers]);
  const clientItems = useMemo(() => customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    description: clientSecondaryIdentity(customer) || "No contact details",
    keywords: clientSearchText(customer),
  })), [customers]);
  const serviceItems = useMemo(() => services.map((service) => ({
    value: service.id,
    label: service.name,
    description: [serviceCategories.find((category) => category.id === service.categoryId)?.name, service.active ? "Active" : "Hidden"].filter(Boolean).join(" · "),
    keywords: [service.name, service.description, ...(service.optionGroups ?? []).flatMap((group) => [group.name, ...group.values.map((value) => value.label)])].join(" "),
    disabled: !service.active && service.id !== selectedServiceId,
  })), [services, serviceCategories, selectedServiceId]);

  // Booking Profit — computed from payments and expenses for this booking
  const totalPaid = bookingPayments.reduce((sum, p) => sum + p.amount, 0);
  const bookingExpensesTotal = booking ? getBookingExpenses(booking.id, expenses) : 0;
  const effectivePrice = Number(servicePriceValue) || 0;
  const additionalChargesTotal = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
  const clientTotal = effectivePrice + additionalChargesTotal;
  const isCancelled = booking?.bookingStatus === "Cancelled";
  const outstanding = isCancelled ? 0 : Math.max(clientTotal - totalPaid, 0);
  const canAddPayment = !isCancelled && outstanding > 0;
  const netRevenue = totalPaid - bookingExpensesTotal;

  useEffect(() => {
    if (!selectedService || booking || lastDefaultedServiceId.current === selectedService.id) return;
    lastDefaultedServiceId.current = selectedService.id;
    const current = watchedSessions ?? [];
    const untouched = current.every((session) =>
      !session.date && !session.startTime && !session.endTime && !session.location && !session.label && !session.notes,
    );
    if (!untouched) return;
    const defaults = selectedServiceSnapshot ?? snapshotServiceSelection(selectedService, defaultServiceVariant(selectedService));
    replace(Array.from({ length: defaults.defaultSessionCount }, () => ({
      id: crypto.randomUUID(),
      label: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      notes: "",
    })));
  }, [selectedService, selectedServiceSnapshot, booking, watchedSessions, replace]);

  function suggestEndTime(index: number) {
    const startTime = watchedSessions?.[index]?.startTime;
    if (!selectedService || !startTime || watchedSessions?.[index]?.endTime) return;
    const [hours, minutes] = startTime.split(":").map(Number);
    const end = new Date(2000, 0, 1, hours, minutes + (selectedServiceSnapshot?.duration ?? selectedService.duration));
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
      id: crypto.randomUUID(),
      label: "",
      date: "",
      startTime: source.startTime ?? "",
      endTime: source.endTime ?? "",
      location: source.location ?? "",
      notes: source.notes ?? "",
    });
  }

  function removeSession(index: number) {
    const sessionId = watchedSessions?.[index]?.id;
    remove(index);
    if (sessionId) {
      setAdditionalCharges((current) => current.map((charge) => charge.sessionId === sessionId ? { ...charge, sessionId: null } : charge));
    }
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
    if (!onQuickCreateCustomer) return;
    const input = customerSchema.safeParse({ ...quickCustomer, notes: "" });
    if (!input.success) {
      setQuickError(input.error.issues[0]?.message ?? "Check the client details.");
      return;
    }
    if (quickCustomerMatches.some((match) => match.strong) && !allowSeparateClient) {
      setQuickError("A client with matching contact details already exists. Use that client, or confirm that this is a separate person.");
      return;
    }
    setQuickPending(true);
    setQuickError("");
    const created = await onQuickCreateCustomer(input.data);
    setQuickPending(false);
    if (!created) {
      setQuickError("Could not add the customer.");
      return;
    }
    setValue("customerId", created.id, { shouldValidate: true });
    setQuickCustomer({ name: "", phone: "", instagram: "", email: "" });
    setQuickCustomerOpen(false);
    setAllowSeparateClient(false);
    notify.success("Client added and selected.");
  }

  function selectService(serviceId: string) {
    setValue("serviceId", serviceId, { shouldDirty: true, shouldValidate: true });
    const service = services.find((item) => item.id === serviceId);
    if (!service) {
      setSelectedVariantId(null);
      setValue("serviceSnapshot", null, { shouldDirty: true });
      return;
    }
    const variant = defaultServiceVariant(service);
    const snapshot = snapshotServiceSelection(service, variant);
    lastDefaultedServiceId.current = service.id;
    setSelectedVariantId(variant?.id ?? null);
    setValue("serviceSnapshot", snapshot, { shouldDirty: true });
    setValue("servicePrice", snapshot.price, { shouldDirty: true, shouldValidate: true });
    if (!booking) {
      const current = watchedSessions ?? [];
      const untouched = current.every((session) => !session.date && !session.startTime && !session.endTime && !session.location && !session.label && !session.notes);
      if (untouched) replace(Array.from({ length: snapshot.defaultSessionCount }, () => ({ id: crypto.randomUUID(), label: "", date: "", startTime: "", endTime: "", location: "", notes: "" })));
    }
  }

  function selectVariant(variantId: string) {
    if (!selectedService) return;
    const variant = selectedService.variants?.find((item) => item.id === variantId && item.active) ?? null;
    const snapshot = snapshotServiceSelection(selectedService, variant);
    setSelectedVariantId(variant?.id ?? null);
    setValue("serviceSnapshot", snapshot, { shouldDirty: true });
    setValue("servicePrice", snapshot.price, { shouldDirty: true, shouldValidate: true });
    if (!booking) {
      const current = watchedSessions ?? [];
      const untouched = current.every((session) => !session.date && !session.startTime && !session.endTime && !session.location && !session.label && !session.notes);
      if (untouched) replace(Array.from({ length: snapshot.defaultSessionCount }, () => ({ id: crypto.randomUUID(), label: "", date: "", startTime: "", endTime: "", location: "", notes: "" })));
    }
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
    selectService(created.id);
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

  function reviewParsedBooking({ parsed, customerId, serviceId, serviceVariantId }: Parameters<React.ComponentProps<typeof BookingCreationStart>["onReview"]>[0]) {
    const matchedService = services.find((service) => service.id === serviceId);
    const matchedVariant = matchedService?.variants?.find((variant) => variant.id === serviceVariantId && variant.active) ?? (matchedService ? defaultServiceVariant(matchedService) : null);
    const matchedSnapshot = matchedService ? snapshotServiceSelection(matchedService, matchedVariant) : null;
    const applicableQuestionIds = new Set(questionsForService(questionnaire, serviceId).map((question) => question.id));
    const parsedResponses = serviceId ? parsed.customResponses.filter((response) => applicableQuestionIds.has(response.questionId)) : parsed.customResponses;
    const sessionId = crypto.randomUUID();
    reset(withSessionIds({
      ...defaultValues,
      customerId,
      serviceId,
      serviceSnapshot: matchedSnapshot,
      servicePrice: matchedSnapshot?.price ?? matchedService?.price ?? 0,
      sessions: [{
        id: sessionId,
        label: "",
        date: parsed.date,
        startTime: parsed.startTime,
        endTime: parsed.endTime || suggestedEndTime(parsed.startTime, matchedSnapshot?.duration ?? matchedService?.duration ?? 60),
        location: parsed.location,
        notes: parsed.notes,
      }],
      fullPaymentDueDate: parsed.date,
      notes: parsed.notes,
      questionnaireResponses: parsedResponses,
    }));
    setQuestionnaireResponses(parsedResponses);
    setSelectedVariantId(matchedVariant?.id ?? null);
    setQuestionnaireErrors({});
    if (!customerId && (parsed.name || parsed.phone || parsed.instagram || parsed.email)) {
      setQuickCustomer({ name: parsed.name, phone: parsed.phone, instagram: parsed.instagram, email: parsed.email });
      setQuickCustomerOpen(true);
    }
    setParsedReviewNotice("Parsed client details were added for review. Nothing has been saved yet.");
    setStartMode("manual");
  }

  function addChargeDraft() {
    const category = chargeCategories.find((item) => item.id === chargeDraft.categoryId);
    if (!category || chargeDraft.amount <= 0) {
      notify.error("Choose a category and enter an amount.");
      return;
    }
    setAdditionalCharges((current) => [...current, {
      id: crypto.randomUUID(),
      sessionId: chargeDraft.sessionId || null,
      categoryId: category.id,
      categoryName: category.name,
      description: chargeDraft.description.trim(),
      amount: chargeDraft.amount,
    }]);
    setChargeDraft((current) => ({ ...current, sessionId: "", amount: 0, description: "" }));
    setAddingCharge(false);
  }

  async function createChargeCategoryInline() {
    if (!newChargeCategoryName.trim()) return notify.error("Enter a category name.");
    try {
      const created = await createAdditionalChargeCategoryPersistent(newChargeCategoryName);
      const loaded = await loadAdditionalChargeCategories();
      setChargeCategories(loaded);
      setChargeDraft((current) => ({ ...current, categoryId: created.id }));
      setNewChargeCategoryName("");
      setNewChargeCategoryOpen(false);
      notify.success("Charge category added and selected.");
    } catch (error) {
      notify.error(error instanceof Error && error.message === "DUPLICATE_CATEGORY" ? "A charge category with this name already exists." : "Could not add that category.");
    }
  }

  function handleClose() {
    reset(defaultValues);
    setInitialPaymentOpen(false);
    setInitialPaymentErrors({});
    setStartMode("choose");
    setParsedReviewNotice("");
    setAdditionalCharges([]);
    setQuestionnaireResponses([]);
    setQuestionnaireErrors({});
    setSelectedVariantId(null);
    setAllowSeparateClient(false);
    onClose();
  }

  async function uploadQuestionFile(_question: BookingQuestion, file: File): Promise<BookingQuestionFileAnswer> {
    if (!["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(file.type) || file.size <= 0 || file.size > 8 * 1024 * 1024) {
      throw new Error("Use a PNG, JPG, WebP, or PDF file up to 8 MB.");
    }
    if (isValidationModeEnabled()) {
      const uploaded = await validationClient.uploadMedia(file, "booking-response");
      return { url: uploaded.url, name: file.name, mimeType: file.type, size: file.size };
    }
    if (file.size > 2 * 1024 * 1024) throw new Error("Local file answers are limited to 2 MB.");
    const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result ?? "")); reader.onerror = () => reject(new Error("Could not read that file.")); reader.readAsDataURL(file); });
    return { url, name: file.name, mimeType: file.type, size: file.size };
  }

  async function onSubmit(values: BookingFormValues) {
    const responseErrors = validateQuestionnaireResponses(questionnaire, values.serviceId, questionnaireResponses);
    setQuestionnaireErrors(responseErrors);
    if (Object.keys(responseErrors).length > 0) {
      notify.error("Complete the required client answers before saving.");
      return;
    }
    const bookingValues: BookingFormValues = {
      ...values,
      serviceSnapshot: selectedService ? snapshotServiceSelection(selectedService, selectedVariant) : values.serviceSnapshot,
      questionnaireResponses,
    };
    let createCommand: CreateBookingCommand | null = null;
    if (!booking) {
      let parsedInitialPayment: InitialPaymentInput | null = null;
      if (initialPaymentOpen) {
        const parsed = initialPaymentSchemaForBooking(bookingValues.servicePrice + additionalChargesTotal).safeParse(initialPayment);
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
        booking: bookingValues,
        initialPayment: parsedInitialPayment,
        additionalCharges,
      };
    }

    const succeeded = await action.run(() => booking
      ? onUpdate({ id: booking.id, ...bookingValues, additionalCharges })
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onClick={() => !action.pending && handleClose()}>
      <div className="flex max-h-dvh w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-border bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-6xl sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title" onClick={(e) => e.stopPropagation()}>
        <div className="z-10 flex shrink-0 items-center justify-between border-b border-border bg-white/95 px-5 py-4 backdrop-blur sm:px-8 sm:py-5">
          <div>
            <h2 id="booking-dialog-title" className="dialog-title">{booking ? "Edit booking" : "New booking"}</h2>
            <p className="mt-2 text-slate-500">
              {booking ? "Update the booking details." : startMode === "manual" ? "Review the client, service, schedule, and price before saving." : "Choose the quickest way to start."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" disabled={action.pending} onClick={handleClose} aria-label="Close booking form">
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        {!booking && startMode !== "manual" ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-8"><BookingCreationStart mode={startMode} customers={customers} services={services} onModeChange={setStartMode} onReview={reviewParsedBooking} /></div>
        ) : <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid min-h-0 flex-1 grid-cols-1 gap-6 overflow-y-auto p-5 sm:p-8 lg:grid-cols-12 lg:items-start"
        >
          {!booking && <div className="lg:col-span-12"><Button type="button" variant="ghost" size="sm" onClick={() => setStartMode("choose")}><ArrowLeft className="size-4" /> Booking options</Button>{parsedReviewNotice && <p className="mt-3 rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-primary">{parsedReviewNotice}</p>}</div>}
          <div className="lg:col-span-6">
            <Label className="mb-2 block font-semibold">Client</Label>
            <Controller
              control={control}
              name="customerId"
              render={({ field }) => (
                <SearchableSelect
                  label="Client"
                  value={field.value}
                  onValueChange={field.onChange}
                  items={clientItems}
                  placeholder="Select a client"
                  searchPlaceholder="Search name, phone, Instagram, or email…"
                  emptyMessage="No matching clients."
                />
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
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><Label className="mb-2 block">Instagram</Label><Input value={quickCustomer.instagram} onChange={(event) => setQuickCustomer((value) => ({ ...value, instagram: event.target.value }))} placeholder="@username" /></div>
                      <div><Label className="mb-2 block">Email</Label><Input type="email" value={quickCustomer.email} onChange={(event) => setQuickCustomer((value) => ({ ...value, email: event.target.value }))} /></div>
                    </div>
                    {quickCustomerMatches.length > 0 && (
                      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm font-semibold text-amber-950">Possible existing clients</p>
                        {quickCustomerMatches.map((match) => (
                          <button key={match.customer.id} type="button" className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-left text-sm" onClick={() => { setValue("customerId", match.customer.id, { shouldDirty: true, shouldValidate: true }); setQuickCustomerOpen(false); setAllowSeparateClient(false); setQuickError(""); }}>
                            <span className="min-w-0"><span className="block truncate font-semibold">{match.customer.name}</span><span className="block truncate text-xs text-muted-foreground">{clientSecondaryIdentity(match.customer) || "Matching name"}</span></span><span className="shrink-0 text-xs font-semibold text-primary">Use existing</span>
                          </button>
                        ))}
                        {quickCustomerMatches.some((match) => match.strong) && <label className="flex min-h-10 items-center gap-2 text-xs text-amber-950"><input type="checkbox" checked={allowSeparateClient} onChange={(event) => setAllowSeparateClient(event.target.checked)} />This is a separate client with shared contact details</label>}
                      </div>
                    )}
                    {quickError && <p className="text-sm text-destructive">{quickError}</p>}
                    <div className="flex gap-2"><Button type="button" size="sm" disabled={quickPending} onClick={createCustomerInline}>{quickPending ? "Adding…" : "Add and select"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setQuickCustomerOpen(false)}>Cancel</Button></div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-6">
            <Label className="mb-2 block font-semibold">Service</Label>
            <Controller
              control={control}
              name="serviceId"
              render={({ field }) => (
                <SearchableSelect
                  label="Service"
                  value={field.value}
                  onValueChange={selectService}
                  items={serviceItems}
                  placeholder="Select a service"
                  searchPlaceholder="Search service, category, or option…"
                  emptyMessage="No matching services."
                />
              )}
            />
            {errors.serviceId && <p className="mt-2 text-sm text-destructive">{errors.serviceId.message}</p>}
            {selectedService && (selectedService.variants ?? []).some((variant) => variant.active) && (
              <div className="mt-4 rounded-xl border border-border bg-muted/25 p-3">
                <Label className="mb-2 block">Service option</Label>
                <select className="native-control" value={selectedVariantId ?? ""} onChange={(event) => selectVariant(event.target.value)}>
                  {(selectedService.variants ?? []).filter((variant) => variant.active).map((variant) => {
                    const snapshot = snapshotServiceSelection(selectedService, variant);
                    return <option key={variant.id} value={variant.id}>{snapshot.variantLabel || "Service option"} · {formatRupiah(snapshot.price)}</option>;
                  })}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">Price, duration, and suggested schedule count follow this valid combination.</p>
              </div>
            )}
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
                      <div><Label className="mb-2 block">Typical duration</Label><EditableNumberInput min={1} inputMode="numeric" value={quickService.duration} emptyValue={1} onValueChange={(duration) => setQuickService((value) => ({ ...value, duration }))} /></div>
                    </div>
                    <div><Label className="mb-2 block">Usual number of schedules</Label><EditableNumberInput min={1} max={50} inputMode="numeric" value={quickService.defaultSessionCount} emptyValue={1} onValueChange={(defaultSessionCount) => setQuickService((value) => ({ ...value, defaultSessionCount }))} /></div>
                    {quickError && <p className="text-sm text-destructive">{quickError}</p>}
                    <div className="flex gap-2"><Button type="button" size="sm" disabled={quickPending} onClick={createServiceInline}>{quickPending ? "Adding…" : "Add and select"}</Button><Button type="button" size="sm" variant="ghost" onClick={() => setQuickServiceOpen(false)}>Cancel</Button></div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-8">
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
                          onClick={() => removeSession(index)}
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
                  <details className="group rounded-xl border border-border bg-white">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                      Optional schedule details
                    </summary>
                    <div className="space-y-4 border-t border-border p-4">
                      <div>
                        <Label className="mb-2 block">Location override</Label>
                        <Input {...register(`sessions.${index}.location`)} placeholder="Use only when this schedule has a different location" />
                        {scheduleFields.length > 1 && session?.location?.trim() && (
                          <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => applyLocationToAll(index)}>
                            Apply this location to all
                          </Button>
                        )}
                      </div>
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
              onClick={() => append({ id: crypto.randomUUID(), label: "", date: "", startTime: "", endTime: "", location: "", notes: "" })}
            >
              <Plus className="size-4" aria-hidden="true" /> Add another schedule
            </Button>
          </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-4 lg:col-span-4">
          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-4">
              <p className="section-kicker">Booking summary</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight">Pricing &amp; status</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
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
          </section>

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="booking-charges-heading">
            <div className="flex items-start justify-between gap-3"><div><h3 id="booking-charges-heading" className="font-semibold">Additional charges</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Client-facing revenue. Business costs remain separate Expenses.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setAddingCharge((value) => !value)}><Plus className="size-4" /> Add charge</Button></div>
            {additionalCharges.length > 0 && <div className="mt-4 space-y-2">{additionalCharges.map((charge) => { const scheduleIndex = (watchedSessions ?? []).findIndex((session) => session.id === charge.sessionId); return <article key={charge.id} className="flex min-w-0 items-start gap-2 rounded-xl bg-muted/55 p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{charge.categoryName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{scheduleIndex >= 0 ? `Schedule ${scheduleIndex + 1}` : "Overall booking"}{charge.description ? ` · ${charge.description}` : ""}</p></div><p className="shrink-0 text-sm font-bold">{formatRupiah(charge.amount)}</p><Button type="button" size="icon-sm" variant="ghost" className="shrink-0 text-destructive" aria-label={`Remove ${charge.categoryName} charge`} onClick={() => setAdditionalCharges((current) => current.filter((item) => item.id !== charge.id))}><Trash2 className="size-4" /></Button></article>; })}</div>}
            {addingCharge && <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/25 p-3">
              <div><Label className="mb-2 block">Category</Label><select className="native-control" value={chargeDraft.categoryId} onChange={(event) => setChargeDraft((current) => ({ ...current, categoryId: event.target.value }))}>{chargeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => setNewChargeCategoryOpen((value) => !value)}>+ New category</Button>{newChargeCategoryOpen && <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={newChargeCategoryName} onChange={(event) => setNewChargeCategoryName(event.target.value)} placeholder="Category name" /><Button type="button" size="sm" onClick={() => void createChargeCategoryInline()}>Add</Button></div>}</div>
              <div><Label className="mb-2 block">Apply to</Label><select className="native-control" value={chargeDraft.sessionId} onChange={(event) => setChargeDraft((current) => ({ ...current, sessionId: event.target.value }))}><option value="">Overall booking</option>{(watchedSessions ?? []).map((session, index) => session.id && <option key={session.id} value={session.id}>Schedule {index + 1}{session.label ? ` · ${session.label}` : ""}</option>)}</select></div>
              <div><Label className="mb-2 block">Amount</Label><MoneyInput value={chargeDraft.amount} onChange={(amount) => setChargeDraft((current) => ({ ...current, amount }))} placeholder="0" /></div>
              <div><Label className="mb-2 block">Note</Label><Input value={chargeDraft.description} onChange={(event) => setChargeDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Optional detail" /></div>
              <div className="flex gap-2"><Button type="button" size="sm" onClick={addChargeDraft}>Add charge</Button><Button type="button" size="sm" variant="ghost" onClick={() => setAddingCharge(false)}>Cancel</Button></div>
            </div>}
            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Service</dt><dd>{formatRupiah(effectivePrice)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">Additional charges</dt><dd>{formatRupiah(additionalChargesTotal)}</dd></div><div className="flex justify-between gap-3 border-t border-border pt-3 text-base font-bold"><dt>Client total</dt><dd>{formatRupiah(clientTotal)}</dd></div></dl>
          </section>

          {!booking && (
            <section className="rounded-xl border border-border bg-card p-4 shadow-sm" aria-labelledby="initial-payment-heading">
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

          <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
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
          </section>
          </aside>

          <div className="lg:col-span-8">
            <Label className="mb-2 block font-semibold">Notes</Label>
            <Textarea rows={4} {...register("notes")} />
          </div>

          {activeQuestions.length > 0 && (
            <div className="lg:col-span-12">
              <QuestionnaireFields
                questions={activeQuestions}
                responses={questionnaireResponses}
                errors={questionnaireErrors}
                onChange={(responses) => {
                  setQuestionnaireResponses(responses);
                  setQuestionnaireErrors({});
                }}
                onUploadFile={async (question, file) => {
                  try {
                    return await uploadQuestionFile(question, file);
                  } catch (error) {
                    notify.error(error instanceof Error ? error.message : "Could not upload that file.");
                    throw error;
                  }
                }}
              />
            </div>
          )}

          {historicalResponses.length > 0 && (
            <div className="lg:col-span-12">
              <HistoricalQuestionnaireResponses responses={historicalResponses} />
            </div>
          )}

          {booking && (
          <div className="rounded-2xl border border-zinc-200 p-4 lg:col-span-12">
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
                        const label = getPaymentLabel(payment, bookingPayments, clientTotal);
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
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:col-span-12">
              <h3 className="mb-3 font-semibold text-slate-900">Booking Profit</h3>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-zinc-500">Client total</p>
                  <p className="font-semibold text-slate-900">{formatRupiah(clientTotal)}</p>
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

          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-2 flex gap-3 border-t border-border bg-white/95 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:-mx-8 sm:-mb-8 sm:justify-end sm:px-8 sm:pb-8 lg:col-span-12">
            <Button type="button" variant="outline" className="flex-1 sm:flex-none" disabled={action.pending} onClick={handleClose}>
              Cancel
            </Button>
            <ActionButton type="submit" className="flex-1 sm:flex-none" loading={action.pending || isSubmitting} loadingText={booking ? "Updating…" : "Saving…"}>
              {booking ? "Save changes" : "Add booking"}
            </ActionButton>
          </div>
        </form>}
      </div>
    </div>
  );
}
