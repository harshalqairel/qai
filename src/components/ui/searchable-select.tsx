"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchableSelectItem = {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
  disabled?: boolean;
};

type SearchableSelectProps = {
  items: SearchableSelectItem[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
};

export function SearchableSelect({
  items,
  value,
  onValueChange,
  label,
  placeholder = "Choose an option",
  searchPlaceholder = "Search…",
  emptyMessage = "No matching options.",
  clearable = true,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = items.find((item) => item.value === value);
  const normalizedQuery = query.normalize("NFKC").trim().toLowerCase();
  const filtered = useMemo(() => items.filter((item) => {
    if (!normalizedQuery) return true;
    return [item.label, item.description, item.keywords].filter(Boolean).join(" ").normalize("NFKC").toLowerCase().includes(normalizedQuery);
  }), [items, normalizedQuery]);
  const enabled = filtered.filter((item) => !item.disabled);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  function choose(item: SearchableSelectItem) {
    if (item.disabled) return;
    onValueChange(item.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative min-w-0", className)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${label.replace(/\W+/g, "-").toLowerCase()}-options`}
        disabled={disabled}
        onClick={() => { setHighlighted(0); setOpen((current) => !current); }}
        className="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg border border-input bg-transparent px-3 py-2 pr-10 text-left text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate", !selected && "text-muted-foreground")}>{selected?.label ?? placeholder}</span>
          {selected?.description && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{selected.description}</span>}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {value && clearable && !disabled && (
        <button
          type="button"
          aria-label={`Clear ${label}`}
          className="absolute right-8 top-2 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => { onValueChange(""); setQuery(""); setOpen(false); }}
        ><X className="size-4" /></button>
      )}
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+0.35rem)] z-[70] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setHighlighted(0); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); setHighlighted((index) => enabled.length ? (index + 1) % enabled.length : 0); }
                if (event.key === "ArrowUp") { event.preventDefault(); setHighlighted((index) => enabled.length ? (index - 1 + enabled.length) % enabled.length : 0); }
                if (event.key === "Enter" && enabled[highlighted]) { event.preventDefault(); choose(enabled[highlighted]); }
                if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(""); }
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div id={`${label.replace(/\W+/g, "-").toLowerCase()}-options`} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p> : filtered.map((item) => {
              const enabledIndex = enabled.findIndex((candidate) => candidate.value === item.value);
              const isHighlighted = enabledIndex === highlighted && !item.disabled;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={item.value === value}
                  disabled={item.disabled}
                  onMouseEnter={() => { if (enabledIndex >= 0) setHighlighted(enabledIndex); }}
                  onClick={() => choose(item)}
                  className={cn("flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-40", isHighlighted ? "bg-accent text-accent-foreground" : "hover:bg-muted")}
                >
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.label}</span>{item.description && <span className="mt-0.5 block truncate text-xs opacity-70">{item.description}</span>}</span>
                  {item.value === value && <Check className="size-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
