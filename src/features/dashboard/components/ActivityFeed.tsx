"use client";

import { useState } from "react";
import type { ActivityItem } from "@/features/dashboard/hooks/useDashboard";

type Props = { items: ActivityItem[] };

const TYPE_LABEL: Record<ActivityItem["type"], string> = {
  booking: "B",
  customer: "C",
  service: "S",
  payment: "P",
  expense: "E",
};

export default function ActivityFeed({ items }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <h3 className="text-lg font-semibold text-slate-900">Activity Feed</h3>
        <span className="flex items-center gap-2 text-sm text-zinc-500">
          {items.length > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              {items.length}
            </span>
          )}
          <svg
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {open && (
        items.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
            No recent activity.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((it) => (
              <li key={it.id} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                  {TYPE_LABEL[it.type]}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm text-slate-900">{it.text}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{new Date(it.timestamp).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
