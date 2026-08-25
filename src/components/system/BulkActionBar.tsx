import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkActionBar({ count, actionLabel, onAction, onClear, disabled = false }: { count: number; actionLabel: string; onAction: () => void; onClear: () => void; disabled?: boolean }) {
  if (count === 0) return null;
  return <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-border bg-card/96 p-2.5 shadow-2xl backdrop-blur-xl lg:sticky lg:bottom-4 lg:inset-x-auto lg:z-20 lg:max-w-none lg:rounded-xl"><p className="min-w-0 flex-1 px-2 text-sm font-semibold tabular-nums">{count} selected</p><Button type="button" size="sm" disabled={disabled} onClick={onAction}>{actionLabel}</Button><Button type="button" variant="ghost" size="icon" aria-label="Clear selection" onClick={onClear}><X className="size-4" /></Button></div>;
}
