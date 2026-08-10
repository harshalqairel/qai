"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";

type MoneyInputProps = Omit<
  React.ComponentProps<"input">,
  "inputMode" | "onChange" | "type" | "value"
> & {
  value: number;
  onChange: (value: number) => void;
};

const idrFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  function MoneyInput({ value, onChange, onBlur, ...props }, ref) {
    const displayValue = Number.isFinite(value) && value > 0 ? idrFormatter.format(value) : "";

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onBlur={onBlur}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          if (!digits) {
            onChange(0);
            return;
          }
          const numericValue = Number(digits);
          if (Number.isSafeInteger(numericValue)) onChange(numericValue);
        }}
      />
    );
  },
);
