"use client";

import { ListFilter } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption<TSort extends string> = {
  value: TSort;
  label: string;
};

type ListSortControlProps<TSort extends string> = {
  value: TSort;
  onChange: (value: TSort) => void;
  options: readonly SortOption<TSort>[];
  className?: string;
  label?: string;
};

export default function ListSortControl<TSort extends string>({
  value,
  onChange,
  options,
  className,
  label = "Sort",
}: ListSortControlProps<TSort>) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <ListFilter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <select
        className="native-control h-11 w-full min-w-0 appearance-none pl-9 pr-9 text-sm font-medium"
        value={value}
        onChange={(event) => onChange(event.target.value as TSort)}
        aria-label={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
