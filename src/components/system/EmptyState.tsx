import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <section className={cn("empty-state", className)}>
      <div className="mx-auto flex size-11 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="empty-title mt-4 text-lg">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="mt-5 min-h-11 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-[var(--brand-hover)]">
          {actionLabel}
        </button>
      )}
    </section>
  );
}

