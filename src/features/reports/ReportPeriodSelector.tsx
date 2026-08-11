"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { ReportPeriodInput, ReportPeriodPreset } from "./financialReport";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function reportPeriodDisplayLabel(value: ReportPeriodInput, fallback?: string): string {
  if (value.preset === "this-month") return "This Month";
  if (value.preset === "last-month") return "Last Month";
  if (value.preset === "this-year") return "This Year";
  if (value.preset === "all-time") return "All Time";
  if (value.preset === "custom") return "Custom Date Range";
  if (fallback) return fallback;
  if (!value.selectedMonth) return "Choose Month…";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.selectedMonth}-01T00:00:00.000Z`));
}

export default function ReportPeriodSelector({
  value,
  onChange,
  currentMonth,
  resolvedLabel,
  includeCustom = false,
  className,
}: {
  value: ReportPeriodInput;
  onChange: (value: ReportPeriodInput) => void;
  currentMonth: string;
  resolvedLabel?: string;
  includeCustom?: boolean;
  className?: string;
}) {
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const currentYear = Number(currentMonth.slice(0, 4));
  const currentMonthNumber = Number(currentMonth.slice(5, 7));
  const selectedYear = Number(value.selectedMonth?.slice(0, 4)) || currentYear;
  const [pickerYear, setPickerYear] = useState(selectedYear);

  function selectPreset(next: string | null) {
    if (!next) return;
    if (next === "choose-month") {
      setPickerYear(selectedYear);
      setMonthPickerOpen(true);
      return;
    }
    onChange({ preset: next as ReportPeriodPreset });
  }

  function selectMonth(month: number) {
    const selectedMonth = `${pickerYear}-${String(month).padStart(2, "0")}`;
    onChange({ preset: "specific-month", selectedMonth });
    setMonthPickerOpen(false);
  }

  const selectValue = value.preset === "specific-month" ? "specific-month" : value.preset;
  return (
    <>
      <Select value={selectValue} onValueChange={selectPreset}>
        <SelectTrigger className={className ?? "w-full bg-white sm:w-48"} aria-label="Reporting period">
          <span className="truncate">{reportPeriodDisplayLabel(value, resolvedLabel)}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-month">This Month</SelectItem>
          <SelectItem value="last-month">Last Month</SelectItem>
          <SelectItem value="choose-month">Choose Month…</SelectItem>
          {value.preset === "specific-month" && (
            <SelectItem value="specific-month">{reportPeriodDisplayLabel(value, resolvedLabel)}</SelectItem>
          )}
          <SelectItem value="this-year">This Year</SelectItem>
          <SelectItem value="all-time">All Time</SelectItem>
          {includeCustom && <SelectItem value="custom">Custom Date Range</SelectItem>}
        </SelectContent>
      </Select>

      <Dialog open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose a month</DialogTitle>
            <DialogDescription>Select any historical month. Future months are unavailable.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon" onClick={() => setPickerYear((year) => year - 1)} aria-label="Previous year">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <p className="text-lg font-semibold" aria-live="polite">{pickerYear}</p>
            <Button type="button" variant="ghost" size="icon" disabled={pickerYear >= currentYear} onClick={() => setPickerYear((year) => year + 1)} aria-label="Next year">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {MONTHS.map((label, index) => {
              const month = index + 1;
              const future = pickerYear > currentYear || (pickerYear === currentYear && month > currentMonthNumber);
              const active = value.selectedMonth === `${pickerYear}-${String(month).padStart(2, "0")}`;
              return (
                <Button key={label} type="button" variant={active ? "default" : "outline"} className="min-h-11 px-2" disabled={future} onClick={() => selectMonth(month)}>
                  {label}
                </Button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
