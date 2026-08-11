"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, MessageCircle, Eye } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { notify } from "@/lib/notifications";
import { addReminderHistory } from "../reminderRepository";
import { buildEmailReminderUrl, buildWhatsAppReminderUrl, type PaymentReminderDetails } from "../reminderTransport";
import type { ReminderMethod } from "../types";

export default function ReminderActions({ bookingId, customerId, customerName, customerPhone, customerEmail, serviceName, businessName, remainingAmount, dueDate }: {
  bookingId: string; customerId: string; customerName: string; customerPhone: string; customerEmail: string;
  serviceName: string; businessName: string; remainingAmount: number; dueDate: string;
}) {
  const [pendingMethod, setPendingMethod] = useState<ReminderMethod | null>(null);
  const details: PaymentReminderDetails = { customerName, businessName, serviceName, remainingAmount: formatRupiah(remainingAmount), dueDate };
  const whatsappUrl = buildWhatsAppReminderUrl(customerPhone, details);
  const emailUrl = buildEmailReminderUrl(customerEmail, details);

  function openReminder(method: ReminderMethod, url: string | null) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    setPendingMethod(method);
  }

  function confirmReminder() {
    if (!pendingMethod) return;
    try {
      addReminderHistory({ id: crypto.randomUUID(), bookingId, customerId, remindedAt: new Date().toISOString(), method: pendingMethod, outstandingBalance: remainingAmount });
      notify.success("Reminder recorded.");
      setPendingMethod(null);
    } catch {
      notify.error("Could not record the reminder.");
    }
  }

  return (
    <>
      <div className="mt-4 grid grid-cols-3 gap-2" onClick={(event) => event.stopPropagation()}>
        <Button type="button" variant="outline" className="min-h-11 px-2 text-xs sm:text-sm" disabled={!whatsappUrl} title={whatsappUrl ? "Open WhatsApp reminder" : "No phone number saved"} onClick={() => openReminder("WhatsApp", whatsappUrl)}>
          <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
        </Button>
        <Button type="button" variant="outline" className="min-h-11 px-2 text-xs sm:text-sm" disabled={!emailUrl} title={emailUrl ? "Open email reminder" : "No email saved"} onClick={() => openReminder("Email", emailUrl)}>
          <Mail className="size-4" aria-hidden="true" /> Email
        </Button>
        <Link href={`/bookings?booking=${encodeURIComponent(bookingId)}`} className={buttonVariants({ variant: "outline", className: "min-h-11 px-2 text-xs sm:text-sm" })}>
          <Eye className="size-4" aria-hidden="true" /> View
        </Link>
      </div>
      {(!whatsappUrl || !emailUrl) && <p className="mt-2 text-xs text-[var(--dashboard-muted-text)]">{!whatsappUrl && "No phone number saved"}{!whatsappUrl && !emailUrl && " · "}{!emailUrl && "No email saved"}</p>}
      <Dialog open={pendingMethod !== null} onOpenChange={(open) => { if (!open) setPendingMethod(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Was the customer reminded?</DialogTitle><DialogDescription>Opening {pendingMethod} does not confirm delivery. Record it only if you completed the reminder.</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setPendingMethod(null)}>Not yet</Button><Button type="button" onClick={confirmReminder}>Mark as reminded</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
