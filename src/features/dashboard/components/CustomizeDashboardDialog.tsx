"use client";

import { ArrowDown, ArrowUp, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DASHBOARD_SECTION_LABELS,
  DEFAULT_DASHBOARD_PREFERENCES,
  moveDashboardSection,
  setDashboardSectionVisible,
  type DashboardPreference,
} from "../customization";

export default function CustomizeDashboardDialog({ open, value, onChange, onClose }: { open: boolean; value: DashboardPreference[]; onChange: (value: DashboardPreference[]) => void; onClose: () => void }) {
  const visibleCount = value.filter((item) => item.visible).length;
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}><DialogContent showCloseButton={false} className="w-[calc(100%-1rem)] max-w-xl gap-4 overflow-x-hidden p-4 sm:p-6"><DialogHeader className="relative min-w-0 pr-11"><DialogTitle className="leading-tight">Customize dashboard</DialogTitle><DialogDescription className="max-w-md leading-5">Choose what you want to see and arrange the order.</DialogDescription><Button type="button" variant="ghost" size="icon" className="absolute -right-1 -top-2" aria-label="Close dashboard customizer" onClick={onClose}><X className="size-5" /></Button></DialogHeader><ol className="min-w-0 space-y-2">{value.map((item, index) => <li key={item.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border p-2.5 sm:p-3"><label className="flex min-h-11 min-w-0 items-center gap-3"><input type="checkbox" className="size-4 shrink-0" checked={item.visible} disabled={item.visible && visibleCount === 1} aria-label={`${item.visible ? "Hide" : "Show"} ${DASHBOARD_SECTION_LABELS[item.id]}`} onChange={(event) => onChange(setDashboardSectionVisible(value, item.id, event.target.checked))} /><span className="min-w-0 break-words text-sm font-semibold leading-5">{DASHBOARD_SECTION_LABELS[item.id]}</span><span className="ml-auto hidden text-xs text-muted-foreground sm:inline">{item.visible ? "Visible" : "Hidden"}</span></label><div className="flex shrink-0 items-center"><Button type="button" variant="ghost" size="icon" aria-label={`Move ${DASHBOARD_SECTION_LABELS[item.id]} up`} disabled={index === 0} onClick={() => onChange(moveDashboardSection(value, item.id, -1))}><ArrowUp className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Move ${DASHBOARD_SECTION_LABELS[item.id]} down`} disabled={index === value.length - 1} onClick={() => onChange(moveDashboardSection(value, item.id, 1))}><ArrowDown className="size-4" /></Button></div></li>)}</ol><p className="text-xs leading-5 text-muted-foreground">Hiding a section changes only this dashboard. Your records and calculations stay unchanged.</p><DialogFooter className="grid grid-cols-2 sm:flex sm:justify-between"><Button variant="ghost" className="min-w-0 px-2" onClick={() => onChange(structuredClone(DEFAULT_DASHBOARD_PREFERENCES))}><RotateCcw className="size-4" /> <span className="truncate">Restore default</span></Button><Button onClick={onClose}>Done</Button></DialogFooter></DialogContent></Dialog>;
}
