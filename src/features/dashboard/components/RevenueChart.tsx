import { useMemo, useState } from "react";
import type { RevenuePoint } from "@/features/dashboard/hooks/useDashboard";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type RevenueChartProps = {
  data: RevenuePoint[];
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CHART_COLORS = {
  received: "var(--dashboard-income)",
  expenses: "var(--dashboard-expense)",
  profit: "var(--dashboard-profit)",
  grid: "var(--dashboard-grid)",
  axisLabel: "var(--dashboard-text)",
};

function getNiceStep(maxAbs: number) {
  if (maxAbs <= 0) return 1;
  const roughStep = maxAbs / 3;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;

  let niceNormalized = 10;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 2.5) niceNormalized = 2.5;
  else if (normalized <= 5) niceNormalized = 5;

  return niceNormalized * magnitude;
}

function formatRupiahAxis(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000) {
    const inMillions = abs / 1_000_000;
    const text = Number.isInteger(inMillions) ? String(inMillions) : inMillions.toFixed(1).replace(/\.0$/, "");
    return `Rp ${sign}${text} jt`;
  }

  if (abs >= 1_000) {
    const inThousands = Math.round(abs / 1_000);
    return `Rp ${sign}${inThousands} rb`;
  }

  return `Rp ${sign}${Math.round(abs)}`;
}

export default function RevenueChart({ data }: RevenueChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const hasData = useMemo(
    () => data.some((month) => month.realized !== 0 || month.expenses !== 0 || month.net !== 0),
    [data],
  );

  const chart = useMemo(() => {
    const width = 960;
    const height = 360;
    const margin = { top: 18, right: 16, bottom: 52, left: 74 };

    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;

    const minValue = Math.min(0, ...data.map((d) => d.net));
    const maxValue = Math.max(0, ...data.map((d) => Math.max(d.realized, d.expenses, d.net)));

    const maxAbs = Math.max(Math.abs(minValue), Math.abs(maxValue));
    const step = getNiceStep(maxAbs);
    const maxTick = Math.ceil(maxValue / step) * step;
    const minTick = Math.floor(minValue / step) * step;

    const tickValues: number[] = [];
    for (let tick = maxTick; tick >= minTick; tick -= step) {
      tickValues.push(Number(tick.toFixed(6)));
    }
    if (!tickValues.includes(0)) {
      tickValues.push(0);
      tickValues.sort((a, b) => b - a);
    }

    const domainMin = Math.min(minTick, 0);
    const domainMax = Math.max(maxTick, 0);
    const domainSpan = Math.max(domainMax - domainMin, 1);

    const valueToY = (value: number) => margin.top + ((domainMax - value) / domainSpan) * plotHeight;
    const zeroY = valueToY(0);

    const groupWidth = data.length > 0 ? plotWidth / data.length : 0;
    const barWidth = Math.max(6, groupWidth * 0.2);
    const barGap = Math.max(2, groupWidth * 0.08);

    const points = data.map((month, index) => {
      const xCenter = margin.left + groupWidth * (index + 0.5);
      const receivedX = xCenter - barWidth - barGap / 2;
      const expenseX = xCenter + barGap / 2;
      const receivedY = valueToY(month.realized);
      const expenseY = valueToY(month.expenses);
      const netY = valueToY(month.net);

      return {
        index,
        month,
        xCenter,
        receivedX,
        expenseX,
        receivedY,
        expenseY,
        netY,
      };
    });

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.xCenter} ${point.netY}`)
      .join(" ");

    return {
      width,
      height,
      margin,
      plotWidth,
      plotHeight,
      barWidth,
      zeroY,
      points,
      linePath,
      tickValues,
      valueToY,
    };
  }, [data]);

  const activeItem = activeIndex !== null ? chart.points[activeIndex] : null;

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--dashboard-text)]">Monthly Money Flow</h2>
          <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">
            Money received, expenses, and profit from January to December.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-[var(--dashboard-muted-text)]">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.received }} aria-hidden="true" />
            Money Received
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CHART_COLORS.expenses }} aria-hidden="true" />
            Expenses
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1" aria-hidden="true">
              <span className="h-0.5 w-3" style={{ backgroundColor: CHART_COLORS.profit }} />
              <span className="h-2 w-2 rounded-full border bg-white" style={{ borderColor: CHART_COLORS.profit }} />
            </span>
            Profit
          </span>
        </div>
      </div>

      {!hasData ? (
        <p className="mt-5 rounded-xl border border-dashed border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-4 text-center text-sm text-[var(--dashboard-muted-text)]">
          No money flow recorded for this year.
        </p>
      ) : (
        <div className="relative mt-5 overflow-hidden rounded-xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)] p-2 sm:p-3">
          {activeItem && (
            <div
              className="pointer-events-none absolute top-2 z-10 rounded-lg border border-[var(--dashboard-border)] bg-white/95 px-3 py-2 text-xs shadow-sm"
              style={{
                left: `${Math.max(12, Math.min(88, ((activeItem.index + 0.5) / chart.points.length) * 100))}%`,
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-semibold text-[var(--dashboard-text)]">{MONTH_SHORT[activeItem.index] ?? activeItem.month.label}</p>
              <p className="mt-1 text-[var(--dashboard-muted-text)]">Money Received: <span className="font-medium text-[var(--dashboard-text)]">{formatRupiah(activeItem.month.realized)}</span></p>
              <p className="text-[var(--dashboard-muted-text)]">Expenses: <span className="font-medium text-[var(--dashboard-text)]">{formatRupiah(activeItem.month.expenses)}</span></p>
              <p className="text-[var(--dashboard-muted-text)]">Profit: <span className="font-medium text-[var(--dashboard-text)]">{formatRupiah(activeItem.month.net)}</span></p>
            </div>
          )}

          <svg
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="h-56 w-full sm:h-64 lg:h-72"
            role="img"
            aria-label="Monthly money flow chart"
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
                    x={chart.margin.left - 12}
                    y={y + 4}
                    textAnchor="end"
                    fontSize="12"
                    fill={CHART_COLORS.axisLabel}
                  >
                    {formatRupiahAxis(tick)}
                  </text>
                </g>
              );
            })}

            <line
              x1={chart.margin.left}
              x2={chart.margin.left + chart.plotWidth}
              y1={chart.zeroY}
              y2={chart.zeroY}
              stroke={CHART_COLORS.grid}
              strokeWidth="1.2"
            />

            {chart.points.map((point) => (
              <g key={point.index}>
                <rect
                  x={point.receivedX}
                  y={Math.min(point.receivedY, chart.zeroY)}
                  width={chart.barWidth}
                  height={Math.abs(chart.zeroY - point.receivedY)}
                  fill={CHART_COLORS.received}
                  rx="2"
                />
                <rect
                  x={point.expenseX}
                  y={Math.min(point.expenseY, chart.zeroY)}
                  width={chart.barWidth}
                  height={Math.abs(chart.zeroY - point.expenseY)}
                  fill={CHART_COLORS.expenses}
                  rx="2"
                />
                <text
                  x={point.xCenter}
                  y={chart.margin.top + chart.plotHeight + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="var(--dashboard-muted-text)"
                >
                  {MONTH_SHORT[point.index] ?? point.month.label.slice(0, 3)}
                </text>
                <rect
                  x={chart.margin.left + (chart.plotWidth / chart.points.length) * point.index}
                  y={chart.margin.top}
                  width={chart.plotWidth / chart.points.length}
                  height={chart.plotHeight}
                  fill="transparent"
                  onMouseEnter={() => setActiveIndex(point.index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onClick={() => setActiveIndex(point.index)}
                />
              </g>
            ))}

            <path
              d={chart.linePath}
              fill="none"
              stroke={CHART_COLORS.profit}
              strokeWidth="2.5"
            />
            {chart.points.map((point) => (
              <circle
                key={`net-${point.index}`}
                cx={point.xCenter}
                cy={point.netY}
                r="3.5"
                fill="white"
                stroke={CHART_COLORS.profit}
                strokeWidth="2"
              />
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}