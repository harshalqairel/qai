"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { notify } from "@/lib/notifications";
import { recordClientCommunication } from "../communicationRepository";
import { COMMUNICATION_TEMPLATE_OPTIONS, friendlyCommunicationInserts, renderCommunicationTemplate } from "../communicationTemplates";
import { buildEmailDraftUrl, buildWhatsAppMessageUrl } from "../communicationTransport";
import type { CommunicationChannel, CommunicationContext, CommunicationTemplateType } from "../types";

type MessageClientDialogProps = {
  open: boolean;
  context: CommunicationContext;
  defaultTemplate?: CommunicationTemplateType;
  onClose: () => void;
  onRecorded?: () => void;
};

export default function MessageClientDialog({ open, context, defaultTemplate = "blank", onClose, onRecorded }: MessageClientDialogProps) {
  const [channel, setChannel] = useState<CommunicationChannel>(() => buildWhatsAppMessageUrl(context.customerPhone, "Draft")
    ? "whatsapp"
    : buildEmailDraftUrl(context.customerEmail, "Draft", "Draft") ? "email" : "whatsapp");
  const [templateType, setTemplateType] = useState<CommunicationTemplateType>(defaultTemplate);
  const [subject, setSubject] = useState(() => renderCommunicationTemplate(defaultTemplate, channel, context).subject);
  const [body, setBody] = useState(() => renderCommunicationTemplate(defaultTemplate, channel, context).body);
  const [saving, setSaving] = useState(false);
  const inserts = friendlyCommunicationInserts(context);

  function applyTemplate(next: CommunicationTemplateType) {
    setTemplateType(next);
    const template = renderCommunicationTemplate(next, channel, context);
    setSubject(template.subject);
    setBody(template.body);
  }

  function changeChannel(next: CommunicationChannel) {
    setChannel(next);
    const template = renderCommunicationTemplate(templateType, next, context);
    setSubject(template.subject);
    setBody(template.body);
  }

  function addInsert(value: string) {
    setBody((current) => `${current}${current.trim() ? "\n\n" : ""}${value}`);
  }

  async function openExternalDraft() {
    const url = channel === "whatsapp"
      ? buildWhatsAppMessageUrl(context.customerPhone, body)
      : buildEmailDraftUrl(context.customerEmail, subject, body);
    if (!url) {
      notify.error(channel === "whatsapp" ? "Add a valid client phone number and message first." : "Add a valid client email address and message first.");
      return;
    }

    setSaving(true);
    window.open(url, "_blank", "noopener,noreferrer");
    try {
      await recordClientCommunication({
        customerId: context.customerId,
        bookingId: context.bookingId ?? null,
        channel,
        templateType,
        actionStatus: channel === "whatsapp" ? "whatsapp_opened" : "email_draft_opened",
        recipientSnapshot: channel === "whatsapp" ? context.customerPhone : context.customerEmail,
        subject: channel === "email" ? subject : null,
        bodySnapshot: body,
        metadata: {
          source: context.bookingId ? "booking" : "customer",
          serviceName: context.serviceName,
        },
      });
      notify.success(channel === "whatsapp" ? "WhatsApp opened. Saved to communication history." : "Email draft opened. Saved to communication history.");
      onRecorded?.();
      onClose();
    } catch {
      notify.error("The message opened, but communication history could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const channelAvailable = channel === "whatsapp"
    ? buildWhatsAppMessageUrl(context.customerPhone, body) !== null
    : buildEmailDraftUrl(context.customerEmail, subject, body) !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Message {context.customerName}</DialogTitle>
          <DialogDescription>Qai prepares an editable draft. Opening it does not prove it was sent.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div>
            <Label htmlFor="communication-channel">Channel</Label>
            <select id="communication-channel" className="native-control mt-2" value={channel} onChange={(event) => changeChannel(event.target.value as CommunicationChannel)}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <Label htmlFor="communication-template">Template</Label>
            <select id="communication-template" className="native-control mt-2" value={templateType} onChange={(event) => applyTemplate(event.target.value as CommunicationTemplateType)}>
              {COMMUNICATION_TEMPLATE_OPTIONS.map((template) => <option key={template.value} value={template.value}>{template.label}</option>)}
            </select>
          </div>
          {channel === "email" && <div><Label htmlFor="communication-subject">Subject</Label><Input id="communication-subject" className="mt-2" maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} /></div>}
          <div>
            <div className="flex items-end justify-between gap-3"><Label htmlFor="communication-body">Message</Label><span className="text-xs text-muted-foreground">{body.length}/4000</span></div>
            <Textarea id="communication-body" className="mt-2 min-h-52" maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Insert booking details</p>
            <div className="mt-2 flex flex-wrap gap-2">{inserts.map((item) => <Button key={item.label} type="button" size="sm" variant="outline" onClick={() => addInsert(item.value)}>{item.label}</Button>)}</div>
          </div>
          {!channelAvailable && <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{channel === "whatsapp" ? "A valid client phone number and message are required." : "A valid client email address and message are required."}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={saving || !channelAvailable} onClick={() => void openExternalDraft()}>
            {channel === "whatsapp" ? <MessageCircle className="size-4" /> : <Mail className="size-4" />}
            {saving ? "Saving…" : channel === "whatsapp" ? "Open WhatsApp" : "Open email draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
