"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortableTableHeaderProps<TSort extends string> = {
  label: string;
  sort: TSort;
  ascending: TSort;
  descending: TSort;
  onSortChange: (sort: TSort) => void;
  align?: "left" | "right";
  className?: string;
};

export default function SortableTableHeader<TSort extends string>({
  label,
  sort,
  ascending,
  descending,
  onSortChange,
  align = "left",
  className,
}: SortableTableHeaderProps<TSort>) {
  const isAscending = sort === ascending;
  const isDescending = sort === descending;
  const ariaSort = isAscending ? "ascending" : isDescending ? "descending" : "none";
  const Icon = isAscending ? ArrowUp : isDescending ? ArrowDown : ArrowUpDown;

  return (
    <TableHead aria-sort={ariaSort} className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        className={cn(
          "group -mx-2 inline-flex h-10 w-[calc(100%+1rem)] items-center gap-1.5 rounded-md px-2 text-left font-semibold outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring/35",
          align === "right" && "justify-end text-right",
        )}
        onClick={() => onSortChange(isAscending ? descending : ascending)}
        aria-label={`Sort by ${label}, ${isAscending ? "descending" : "ascending"}`}
      >
        <span>{label}</span>
        <Icon
          className={cn(
            "size-3.5 shrink-0 transition-opacity",
            isAscending || isDescending ? "text-foreground" : "text-muted-foreground/55 group-hover:text-muted-foreground",
          )}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  );
}
