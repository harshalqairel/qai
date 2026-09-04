"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Eye } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import type { DerivedPaymentStatus } from "@/features/payment/types";
import { bookingPaymentHref } from "@/features/booking/domain/bookingDeepLinks";
import { notify } from "@/lib/notifications";
import { addReminderHistory } from "../reminderRepository";
import { LOCAL_BUSINESS_ID, renderReminderTemplate, scenarioTemplate } from "../reminderTemplates";
import { buildEmailReminderUrl, buildWhatsAppReminderUrl, normalizePhoneForWhatsApp, type PaymentReminderDetails } from "../reminderTransport";
import type { ReminderMethod, ReminderType } from "../types";
import { useReminderTemplates } from "../useReminderTemplates";

export default function ReminderActions({ bookingId, customerId, customerName, customerPhone, customerEmail, serviceName, businessName, remainingAmount, dueDate, reminderType, paymentStatus, bookingDate = "", bookingValue = 0, totalPaid = 0, nextSessionDate = "", businessId = LOCAL_BUSINESS_ID }: {
  bookingId: string; customerId: string; customerName: string; customerPhone: string; customerEmail: string;
  serviceName: string; businessName: string; remainingAmount: number; dueDate: string; reminderType: ReminderType;
  paymentStatus: DerivedPaymentStatus;
  bookingDate?: string; bookingValue?: number; totalPaid?: number; nextSessionDate?: string; businessId?: string;
}) {
  const [pendingMethod, setPendingMethod] = useState<ReminderMethod | null>(null);
  const recording = useRef(false);
  const { templates } = useReminderTemplates(businessId);
  const selectedTemplate = scenarioTemplate(templates, reminderType);
  const details: PaymentReminderDetails = {
    customerName,
    businessName,
    serviceName,
    bookingDate,
    dueDate,
    bookingValue: formatRupiah(bookingValue),
    totalPaid: formatRupiah(totalPaid),
    remainingAmount: formatRupiah(remainingAmount),
    nextSessionDate,
  };
  const whatsappAvailable = Boolean(normalizePhoneForWhatsApp(customerPhone));
  const emailAvailable = Boolean(customerEmail.trim());

  function openReminder(method: ReminderMethod) {
    const fieldTemplates = method === "WhatsApp"
      ? [selectedTemplate.whatsapp]
      : [selectedTemplate.emailSubject, selectedTemplate.emailBody];
    const errors = fieldTemplates.flatMap((template) => renderReminderTemplate(template, details).errors);
    if (errors.length > 0) {
      notify.error(errors[0]);
      return;
    }
    const url = method === "WhatsApp"
      ? buildWhatsAppReminderUrl(customerPhone, selectedTemplate.whatsapp, details)
      : buildEmailReminderUrl(customerEmail, selectedTemplate.emailSubject, selectedTemplate.emailBody, details);
    if (!url) {
      notify.error(method === "WhatsApp" ? "Add a valid customer phone number first." : "Add a customer email address first.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    setPendingMethod(method);
  }

  function confirmReminder() {
    if (!pendingMethod || recording.current) return;
    try {
      recording.current = true;
      addReminderHistory({
        id: crypto.randomUUID(),
        businessId,
        bookingId,
        customerId,
        remindedAt: new Date().toISOString(),
        method: pendingMethod,
        reminderType,
        outstandingBalance: remainingAmount,
        dueDateSnapshot: dueDate,
      });
      notify.success("Reminder marked.");
      setPendingMethod(null);
    } catch {
      notify.error("Could not record the reminder.");
    } finally {
      recording.current = false;
    }
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-2" onClick={(event) => event.stopPropagation()}>
        <Button type="button" variant="outline" className="min-h-11 px-2 text-xs sm:text-sm" disabled={!whatsappAvailable} title={whatsappAvailable ? "Open WhatsApp reminder" : "No phone number saved"} onClick={() => openReminder("WhatsApp")}>
          <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
        </Button>
        <Button type="button" variant="outline" className="min-h-11 px-2 text-xs sm:text-sm" disabled={!emailAvailable} title={emailAvailable ? "Open email reminder" : "No email saved"} onClick={() => openReminder("Email")}>
          <Mail className="size-4" aria-hidden="true" /> Email
        </Button>
        <Link href={bookingPaymentHref(paymentStatus, bookingId)} className={buttonVariants({ variant: "outline", className: "min-h-11 px-2 text-xs sm:text-sm" })}>
          <Eye className="size-4" aria-hidden="true" /> View booking
        </Link>
      </div>
      {(!whatsappAvailable || !emailAvailable) && <p className="mt-2 text-xs text-[var(--dashboard-muted-text)]">{!whatsappAvailable && "No phone number saved"}{!whatsappAvailable && !emailAvailable && " · "}{!emailAvailable && "No email saved"}</p>}
      <Dialog open={pendingMethod !== null} onOpenChange={(open) => { if (!open) setPendingMethod(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Did you send the reminder?</DialogTitle><DialogDescription>Qai can&apos;t confirm whether the message was sent.</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setPendingMethod(null)}>Not yet</Button><Button type="button" onClick={confirmReminder}>Yes, mark as reminded</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
