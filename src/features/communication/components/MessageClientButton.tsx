"use client";

import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import type { CommunicationContext, CommunicationTemplateType } from "../types";
import MessageClientDialog from "./MessageClientDialog";

type MessageClientButtonProps = {
  context: CommunicationContext;
  defaultTemplate?: CommunicationTemplateType;
  label?: string;
  onRecorded?: () => void;
  buttonProps?: Omit<ComponentProps<typeof Button>, "onClick" | "children">;
};

export default function MessageClientButton({ context, defaultTemplate = "blank", label = "Message client", onRecorded, buttonProps }: MessageClientButtonProps) {
  const [open, setOpen] = useState(false);
  const hasContact = context.customerPhone.trim().length > 0 || context.customerEmail.trim().length > 0;
  return (
    <>
      <Button type="button" variant="outline" size="sm" {...buttonProps} disabled={buttonProps?.disabled || !hasContact} title={hasContact ? undefined : "No phone number or email saved"} onClick={(event) => { event.stopPropagation(); setOpen(true); }}>
        <MessageCircle className="size-4" /> {label}
      </Button>
      {open && <MessageClientDialog open context={context} defaultTemplate={defaultTemplate} onRecorded={onRecorded} onClose={() => setOpen(false)} />}
    </>
  );
}
