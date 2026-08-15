"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type EditableNumberInputProps = Omit<
  React.ComponentProps<"input">,
  "onChange" | "type" | "value"
> & {
  value: number;
  onValueChange: (value: number) => void;
  emptyValue?: number;
};

/**
 * Keeps the user's text draft separate from the parsed domain value. This lets
 * a controlled numeric field remain empty while it is being edited instead of
 * immediately snapping back to zero.
 */
export function EditableNumberInput({
  value,
  onValueChange,
  emptyValue = 0,
  onFocus,
  onBlur,
  ...props
}: EditableNumberInputProps) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const displayedValue = draft ?? (Number.isFinite(value) ? String(value) : "");

  return (
    <Input
      {...props}
      type="number"
      value={displayedValue}
      onFocus={(event) => {
        setDraft(displayedValue === "0" ? "" : displayedValue);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        if (nextDraft.trim() === "") return;
        const parsed = Number(nextDraft);
        if (Number.isFinite(parsed)) onValueChange(parsed);
      }}
      onBlur={(event) => {
        if (draft?.trim() === "") onValueChange(emptyValue);
        setDraft(null);
        onBlur?.(event);
      }}
    />
  );
}
