"use client";

import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type RowAction = {
  label: string;
  icon: LucideIcon;
  onSelect?: () => void;
  href?: string;
  target?: string;
  destructive?: boolean;
  separatorBefore?: boolean;
  disabled?: boolean;
};

type RowActionsMenuProps = {
  actions: readonly RowAction[];
  recordLabel: string;
  className?: string;
};

export default function RowActionsMenu({ actions, recordLabel, className }: RowActionsMenuProps) {
  return (
    <span
      className={cn("inline-flex", className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Actions for ${recordLabel}`}
              title={`Actions for ${recordLabel}`}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Fragment key={action.label}>
                {action.separatorBefore && <DropdownMenuSeparator />}
                <DropdownMenuItem
                  variant={action.destructive ? "destructive" : "default"}
                  disabled={action.disabled}
                  onClick={action.onSelect}
                  render={action.href ? <a href={action.href} target={action.target} rel={action.target === "_blank" ? "noreferrer" : undefined} /> : undefined}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {action.label}
                </DropdownMenuItem>
              </Fragment>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
