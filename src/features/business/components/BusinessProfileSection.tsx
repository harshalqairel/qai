"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";

import ActionButton from "@/components/system/ActionButton";
import DataErrorState from "@/components/system/DataErrorState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { getActiveBusinessContext, resetActiveBusinessContext } from "@/lib/supabase/cloudRepositories";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Business name is required.").max(120),
  displayName: z.string().trim().max(120),
  email: z.string().trim().email("Enter a valid email.").or(z.literal("")),
  whatsappNumber: z.string().trim().max(30),
  instagram: z.string().trim().max(80),
  address: z.string().trim().max(500),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  timezone: z.string().trim().min(1, "Timezone is required.").max(80),
  invoicePrefix: z.string().trim().min(1).max(12),
  paymentInstructions: z.string().trim().max(2000),
  defaultPaymentTerms: z.string().trim().max(2000),
  defaultTermsAndConditions: z.string().trim().max(5000),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const DEFAULT_VALUES: ProfileFormValues = {
  name: "",
  displayName: "",
  email: "",
  whatsappNumber: "",
  instagram: "",
  address: "",
  currency: "IDR",
  timezone: "Asia/Jakarta",
  invoicePrefix: "INV",
  paymentInstructions: "",
  defaultPaymentTerms: "",
  defaultTermsAndConditions: "",
};

const LOGO_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

export default function BusinessProfileSection() {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });
  const action = useActionGuard();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { businessId } = await getActiveBusinessContext();
      const supabase = createClient();
      const { data, error } = await supabase
        .from("businesses")
        .select("name, display_name, logo_path, email, whatsapp_number, instagram, address, currency, timezone, invoice_prefix, payment_instructions, default_payment_terms, default_terms_and_conditions")
        .eq("id", businessId)
        .single();
      if (error) throw error;

      form.reset({
        name: data.name ?? "",
        displayName: data.display_name ?? "",
        email: data.email ?? "",
        whatsappNumber: data.whatsapp_number ?? "",
        instagram: data.instagram ?? "",
        address: data.address ?? "",
        currency: data.currency ?? "IDR",
        timezone: data.timezone ?? "Asia/Jakarta",
        invoicePrefix: data.invoice_prefix ?? "INV",
        paymentInstructions: data.payment_instructions ?? "",
        defaultPaymentTerms: data.default_payment_terms ?? "",
        defaultTermsAndConditions: data.default_terms_and_conditions ?? "",
      });
      if (data.logo_path) {
        const publicUrl = supabase.storage.from("business-logos").getPublicUrl(data.logo_path);
        setLogoUrl(publicUrl.data.publicUrl);
      } else {
        setLogoUrl(null);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void loadProfile(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadProfile]);

  async function saveProfile(values: ProfileFormValues) {
    const succeeded = await action.run(async () => {
      const { businessId } = await getActiveBusinessContext();
      const supabase = createClient();
      let logoPath: string | undefined;

      if (logoFile) {
        const extension = LOGO_TYPES.get(logoFile.type);
        if (!extension || logoFile.size > 2 * 1024 * 1024) {
          notify.error("Use a PNG, JPG, or WebP logo up to 2 MB.");
          return false;
        }
        logoPath = `${businessId}/logo.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("business-logos")
          .upload(logoPath, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadError) return false;
      }

      const updateValues = {
        name: values.name,
        display_name: values.displayName || null,
        email: values.email || null,
        whatsapp_number: values.whatsappNumber || null,
        instagram: values.instagram || null,
        address: values.address || null,
        currency: values.currency.toUpperCase(),
        timezone: values.timezone,
        invoice_prefix: values.invoicePrefix.toUpperCase(),
        payment_instructions: values.paymentInstructions,
        default_payment_terms: values.defaultPaymentTerms,
        default_terms_and_conditions: values.defaultTermsAndConditions,
        ...(logoPath ? { logo_path: logoPath } : {}),
      };
      const { error } = await supabase
        .from("businesses")
        .update(updateValues)
        .eq("id", businessId);
      if (error) return false;

      resetActiveBusinessContext();
      setLogoFile(null);
      await loadProfile();
      return true;
    });

    if (succeeded) notify.success("Business profile updated.");
    else notify.error("Could not update the business profile. Try again.");
  }

  if (loading) {
    return (
      <section className="surface-card flex min-h-48 items-center justify-center p-6" role="status">
        <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Loading business profile</span>
      </section>
    );
  }

  if (loadError) return <section className="surface-card p-6"><DataErrorState onRetry={() => { void loadProfile(); }} /></section>;

  const errors = form.formState.errors;
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight">Business Profile</h2>
      <p className="mt-2 text-sm text-muted-foreground">Used on invoices, reminders, and connected services.</p>

      <form onSubmit={form.handleSubmit(saveProfile)} className="mt-7 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-xl font-semibold text-muted-foreground">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Current business logo" className="size-full object-contain p-2" />
            ) : "Logo"}
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="business-logo">Business logo</Label>
            <Input
              id="business-logo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-2"
              onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
            />
            <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, or WebP up to 2 MB.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Business name" error={errors.name?.message}><Input {...form.register("name")} /></Field>
          <Field label="Owner / display name" error={errors.displayName?.message}><Input {...form.register("displayName")} /></Field>
          <Field label="Business email" error={errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
          <Field label="WhatsApp number" error={errors.whatsappNumber?.message}><Input inputMode="tel" {...form.register("whatsappNumber")} /></Field>
          <Field label="Instagram" error={errors.instagram?.message}><Input {...form.register("instagram")} /></Field>
          <Field label="Invoice prefix" error={errors.invoicePrefix?.message}><Input {...form.register("invoicePrefix")} /></Field>
          <Field label="Currency" error={errors.currency?.message}><Input maxLength={3} {...form.register("currency")} /></Field>
          <Field label="Timezone" error={errors.timezone?.message}><Input {...form.register("timezone")} /></Field>
        </div>

        <Field label="Address" error={errors.address?.message}><Textarea rows={3} {...form.register("address")} /></Field>
        <Field label="Bank / payment instructions" error={errors.paymentInstructions?.message}><Textarea rows={3} {...form.register("paymentInstructions")} /></Field>
        <Field label="Default payment terms" error={errors.defaultPaymentTerms?.message}><Textarea rows={3} {...form.register("defaultPaymentTerms")} /></Field>
        <Field label="Default Terms & Conditions" error={errors.defaultTermsAndConditions?.message}><Textarea rows={4} {...form.register("defaultTermsAndConditions")} /></Field>

        <div className="flex justify-end">
          <ActionButton type="submit" loading={action.pending} loadingText="Saving…">Save profile</ActionButton>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <span className="block text-sm text-destructive">{error}</span>}
    </label>
  );
}
