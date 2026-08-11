"use client";

import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
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
  return <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Customize dashboard</DialogTitle><DialogDescription>Choose what you want to see and arrange the order.</DialogDescription></DialogHeader><ol className="space-y-2">{value.map((item, index) => <li key={item.id} className="flex items-center gap-2 rounded-xl border border-border p-3"><label className="flex min-h-10 min-w-0 flex-1 items-center gap-3"><input type="checkbox" className="size-4 shrink-0" checked={item.visible} disabled={item.visible && visibleCount === 1} onChange={(event) => onChange(setDashboardSectionVisible(value, item.id, event.target.checked))} /><span className="truncate text-sm font-semibold">{DASHBOARD_SECTION_LABELS[item.id]}</span><span className="ml-auto text-xs text-muted-foreground">{item.visible ? "Visible" : "Hidden"}</span></label><Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${DASHBOARD_SECTION_LABELS[item.id]} up`} disabled={index === 0} onClick={() => onChange(moveDashboardSection(value, item.id, -1))}><ArrowUp className="size-4" /></Button><Button type="button" variant="ghost" size="icon-sm" aria-label={`Move ${DASHBOARD_SECTION_LABELS[item.id]} down`} disabled={index === value.length - 1} onClick={() => onChange(moveDashboardSection(value, item.id, 1))}><ArrowDown className="size-4" /></Button></li>)}</ol><p className="text-xs text-muted-foreground">Hiding a section changes only this dashboard. Your records and calculations stay unchanged.</p><DialogFooter className="sm:justify-between"><Button variant="ghost" onClick={() => onChange(structuredClone(DEFAULT_DASHBOARD_PREFERENCES))}><RotateCcw className="size-4" /> Restore default</Button><Button onClick={onClose}>Done</Button></DialogFooter></DialogContent></Dialog>;
}
