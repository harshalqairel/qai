"use client";

import { useMemo, useState } from "react";
import type { RevenuePoint } from "@/features/dashboard/hooks/useDashboard";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import { changeTone, comparableChange, type ComparableChange } from "@/features/dashboard/analytics";

type RevenueChartProps = {
  data: RevenuePoint[];
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const CHART_COLORS = {
  received: "var(--dashboard-chart-received)",
  expenses: "var(--dashboard-chart-expenses)",
  profit: "var(--dashboard-chart-profit)",
  grid: "var(--dashboard-chart-grid)",
  axisLabel: "var(--dashboard-chart-axis)",
};

function getNiceStep(roughStep: number): number {
  if (roughStep <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function getAxisTicks(minValue: number, maxValue: number): {
  minTick: number;
  maxTick: number;
  tickValues: number[];
} {
  const range = Math.max(maxValue - minValue, 1);
  let step = getNiceStep(range / 5);
  let minTick = Math.floor(minValue / step) * step;
  let maxTick = Math.ceil(maxValue / step) * step;
  let tickCount = Math.round((maxTick - minTick) / step) + 1;

  while (tickCount > 6) {
    step = getNiceStep(step * 1.01);
    minTick = Math.floor(minValue / step) * step;
    maxTick = Math.ceil(maxValue / step) * step;
    tickCount = Math.round((maxTick - minTick) / step) + 1;
  }

  const tickValues = Array.from(
    { length: tickCount },
    (_, index) => Number((maxTick - index * step).toFixed(6)),
  );

  return { minTick, maxTick, tickValues };
}

function formatScaledValue(value: number, divisor: number): string {
  const scaled = value / divisor;
  const formatted = Number.isInteger(scaled) ? scaled.toFixed(0) : scaled.toFixed(1);
  return formatted.replace(".", ",");
}

function formatRupiahAxis(value: number): string {
  const absolute = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (absolute >= 1_000_000_000) {
    return `Rp ${sign}${formatScaledValue(absolute, 1_000_000_000)} M`;
  }
  if (absolute >= 1_000_000) {
    return `Rp ${sign}${formatScaledValue(absolute, 1_000_000)} jt`;
  }
  if (absolute >= 1_000) {
    return `Rp ${sign}${formatScaledValue(absolute, 1_000)} rb`;
  }
  return `Rp ${sign}${Math.round(absolute)}`;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(() => data.length > 0 ? Math.min(new Date().getMonth(), data.length - 1) : null);

  const hasData = useMemo(
    () => data.some((month) => month.realized !== 0 || month.expenses !== 0 || month.net !== 0),
    [data],
  );

  const chart = useMemo(() => {
    const width = 960;
    const height = 360;
    const margin = { top: 24, right: 16, bottom: 52, left: 88 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const minValue = Math.min(0, ...data.map((month) => month.net));
    const maxValue = Math.max(
      0,
      ...data.map((month) => Math.max(month.realized, month.expenses, month.net)),
    );
    const { minTick, maxTick, tickValues } = getAxisTicks(minValue, maxValue);
    const domainSpan = Math.max(maxTick - minTick, 1);
    const valueToY = (value: number) =>
      margin.top + ((maxTick - value) / domainSpan) * plotHeight;
    const zeroY = valueToY(0);

    const groupWidth = data.length > 0 ? plotWidth / data.length : 0;
    const barWidth = Math.max(8, groupWidth * 0.21);
    const barGap = Math.max(4, groupWidth * 0.09);

    const points = data.map((month, index) => {
      const xCenter = margin.left + groupWidth * (index + 0.5);
      return {
        index,
        month,
        xCenter,
        receivedX: xCenter - barWidth - barGap / 2,
        expenseX: xCenter + barGap / 2,
        receivedY: valueToY(month.realized),
        expenseY: valueToY(month.expenses),
        profitY: valueToY(month.net),
      };
    });

    const profitPath = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.xCenter} ${point.profitY}`)
      .join(" ");

    return {
      width,
      height,
      margin,
      plotWidth,
      plotHeight,
      groupWidth,
      barWidth,
      zeroY,
      points,
      profitPath,
      tickValues,
      valueToY,
    };
  }, [data]);

  const activeItem = activeIndex === null ? null : chart.points[activeIndex];
  const previousMonth = activeItem && activeItem.index > 0 ? data[activeItem.index - 1] : null;

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Revenue, expenses, and profit</h2>
          <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">
            Income, expenses, and profit from January to December.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-[var(--dashboard-muted-text)]">
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-3 rounded-t-sm"
              style={{ backgroundColor: CHART_COLORS.received }}
              aria-hidden="true"
            />
            Revenue
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-3 rounded-t-sm"
              style={{ backgroundColor: CHART_COLORS.expenses }}
              aria-hidden="true"
            />
            Expenses
          </span>
          <span className="flex items-center gap-2">
            <span className="relative h-2.5 w-5" aria-hidden="true">
              <span
                className="absolute left-0 top-1 h-[3px] w-5"
                style={{ backgroundColor: CHART_COLORS.profit }}
              />
              <span
                className="absolute left-2 top-0 h-2.5 w-2.5 rounded-full border-2 bg-white"
                style={{ borderColor: CHART_COLORS.profit }}
              />
            </span>
            Profit
          </span>
        </div>
      </div>

      {!hasData ? (
        <p className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-4 text-center text-sm text-[var(--dashboard-muted-text)]">
          No income or expenses recorded for this year.
        </p>
      ) : (
        <div className="mt-5 min-w-0 rounded-xl bg-white">
          <div className="relative min-w-0 p-1 sm:p-3">
            {activeItem && (
              <div
                className="pointer-events-none absolute top-2 z-10 hidden rounded-lg border border-[var(--dashboard-chart-tooltip-border)] bg-[var(--dashboard-chart-tooltip-bg)] px-3 py-2 text-xs shadow-sm sm:block"
                style={{
                  left: `${Math.max(12, Math.min(88, ((activeItem.index + 0.5) / chart.points.length) * 100))}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <p className="font-semibold text-[var(--dashboard-text)]">{activeItem.month.label}</p>
                <MetricChangeLine label="Income" value={activeItem.month.realized} previous={previousMonth?.realized ?? 0} metric="revenue" />
                <MetricChangeLine label="Expenses" value={activeItem.month.expenses} previous={previousMonth?.expenses ?? 0} metric="expenses" />
                <MetricChangeLine label="Profit" value={activeItem.month.net} previous={previousMonth?.net ?? 0} metric="profit" />
              </div>
            )}

            <svg
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              className="h-48 w-full sm:h-72"
              role="img"
              aria-label="Monthly money flow: Income and Expenses bars with a Profit line"
            >
              {chart.tickValues.map((tick) => {
                const y = chart.valueToY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={chart.margin.left}
                      x2={chart.margin.left + chart.plotWidth}
                      y1={y}
                      y2={y}
                      stroke={CHART_COLORS.grid}
                      strokeWidth="1"
                    />
                    <text
                      x={chart.margin.left - 16}
                      y={y + 5}
                      textAnchor="end"
                      fontSize="14"
                      fill={CHART_COLORS.axisLabel}
                      className="hidden sm:block"
                    >
                      {formatRupiahAxis(tick)}
                    </text>
                  </g>
                );
              })}

              {chart.points.map((point) => (
                <g key={point.index}>
                  <rect
                    x={point.receivedX}
                    y={Math.min(point.receivedY, chart.zeroY)}
                    width={chart.barWidth}
                    height={Math.abs(chart.zeroY - point.receivedY)}
                    fill={CHART_COLORS.received}
                    rx="3"
                    ry="3"
                  />
                  <rect
                    x={point.expenseX}
                    y={Math.min(point.expenseY, chart.zeroY)}
                    width={chart.barWidth}
                    height={Math.abs(chart.zeroY - point.expenseY)}
                    fill={CHART_COLORS.expenses}
                    rx="3"
                    ry="3"
                  />
                  <text
                    x={point.xCenter}
                    y={chart.margin.top + chart.plotHeight + 22}
                    textAnchor="middle"
                    fontSize="11"
                    fill={CHART_COLORS.axisLabel}
                    className="hidden sm:block"
                  >
                    {point.month.label}
                  </text>
                </g>
              ))}

              <path
                d={chart.profitPath}
                fill="none"
                stroke={CHART_COLORS.profit}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {chart.points.map((point) => (
                <circle
                  key={`profit-${point.index}`}
                  cx={point.xCenter}
                  cy={point.profitY}
                  r="4"
                  fill="white"
                  stroke={CHART_COLORS.profit}
                  strokeWidth="2.5"
                />
              ))}

              {chart.points.map((point) => (
                <rect
                  key={`hit-${point.index}`}
                  x={chart.margin.left + chart.groupWidth * point.index}
                  y={chart.margin.top}
                  width={chart.groupWidth}
                  height={chart.plotHeight}
                  fill="transparent"
                  onPointerEnter={() => setActiveIndex(point.index)}
                  onClick={() => setActiveIndex(point.index)}
                />
              ))}
            </svg>
            <div className="grid grid-cols-6 gap-1 px-1 sm:hidden" aria-label="Select month">{data.map((month, index) => <button key={month.label} type="button" aria-pressed={activeIndex === index} onClick={() => setActiveIndex(index)} className="min-h-9 rounded-md text-[11px] font-semibold text-muted-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary">{MONTH_SHORT[index]}</button>)}</div>
          </div>
          {activeItem && <div className="mx-2 mb-2 grid grid-cols-3 gap-2 rounded-xl border border-[var(--dashboard-chart-tooltip-border)] bg-[var(--dashboard-chart-tooltip-bg)] p-3 sm:mx-3 sm:mb-3"><div className="col-span-3 flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[var(--dashboard-text)]">{activeItem.month.label}</p><p className="text-[11px] text-[var(--dashboard-muted-text)]">vs {previousMonth?.label ?? "previous month"}</p></div><MetricChangeSummary label="Income" value={activeItem.month.realized} previous={previousMonth?.realized ?? 0} metric="revenue" /><MetricChangeSummary label="Expenses" value={activeItem.month.expenses} previous={previousMonth?.expenses ?? 0} metric="expenses" /><MetricChangeSummary label="Profit" value={activeItem.month.net} previous={previousMonth?.net ?? 0} metric="profit" /></div>}
        </div>
      )}
    </section>
  );
}

function changeLabel(change: ComparableChange): string {
  if (change.state === "new") return "New";
  if (change.state === "neutral") return "—";
  const symbol = change.direction === "up" ? "↑" : change.direction === "down" ? "↓" : "—";
  return change.direction === "flat" ? symbol : `${symbol} ${Math.abs(change.percentage).toFixed(1)}%`;
}

function changeClass(change: ComparableChange, metric: "revenue" | "expenses" | "profit") {
  const tone = changeTone(change, metric);
  return tone === "positive" ? "text-emerald-700" : tone === "negative" ? "text-rose-700" : "text-[var(--dashboard-muted-text)]";
}

function MetricChangeLine({ label, value, previous, metric }: { label: string; value: number; previous: number; metric: "revenue" | "expenses" | "profit" }) {
  const change = comparableChange(value, previous);
  return <p className="mt-1 flex items-center justify-between gap-3 text-[var(--dashboard-muted-text)]"><span>{label}: <strong className="font-medium text-[var(--dashboard-text)]">{formatRupiah(value)}</strong></span><span className={changeClass(change, metric)}>{changeLabel(change)}</span></p>;
}

function MetricChangeSummary({ label, value, previous, metric }: { label: string; value: number; previous: number; metric: "revenue" | "expenses" | "profit" }) {
  const change = comparableChange(value, previous);
  return <div className="min-w-0"><p className="text-[10px] font-medium text-[var(--dashboard-muted-text)] sm:text-xs">{label}</p><p className="mt-1 truncate text-xs font-bold tabular-nums text-[var(--dashboard-text)] sm:text-sm">{formatRupiah(value)}</p><p className={`mt-1 text-[10px] font-semibold sm:text-xs ${changeClass(change, metric)}`}>{changeLabel(change)}</p></div>;
}
