export type ServiceGridTemplate = "Muse" | "Studio" | "Signature" | "Professional" | "Warm" | "Editorial";

export type ServiceGridPlacement = {
  row: number;
  start: number;
  span: number;
};

export type ServiceGridPlan = {
  columns: number;
  rows: number[];
  placements: ServiceGridPlacement[];
};

const GRID_TRACKS = 24;

export function serviceGridDesktopLimit(template: ServiceGridTemplate): number {
  return template === "Signature" || template === "Editorial" ? 3 : 4;
}

/**
 * Distribute known items into the fewest rows, then balance row sizes. This
 * naturally produces 3+2 for five, 3+3 for six, 4+3 for seven, and 3x3 for
 * nine instead of leaving a one-card orphan after a fixed four-column row.
 */
export function createServiceGridPlan(count: number, maximumColumns: number): ServiceGridPlan {
  const safeCount = Math.max(0, Math.trunc(count));
  const limit = Math.max(1, Math.min(4, Math.trunc(maximumColumns)));
  if (safeCount === 0) return { columns: 1, rows: [], placements: [] };

  const rowCount = Math.ceil(safeCount / limit);
  const smallestRow = Math.floor(safeCount / rowCount);
  const largerRows = safeCount % rowCount;
  const rows = Array.from({ length: rowCount }, (_, index) => smallestRow + (index < largerRows ? 1 : 0));
  const columns = Math.max(...rows);
  const span = GRID_TRACKS / columns;
  const placements: ServiceGridPlacement[] = [];

  rows.forEach((itemsInRow, row) => {
    const offset = (GRID_TRACKS - itemsInRow * span) / 2;
    for (let index = 0; index < itemsInRow; index += 1) {
      placements.push({ row, start: offset + index * span + 1, span });
    }
  });

  return { columns, rows, placements };
}

export function createResponsiveServiceGridPlans(count: number, template: ServiceGridTemplate) {
  return {
    mobile: createServiceGridPlan(count, 1),
    tablet: createServiceGridPlan(count, 2),
    desktop: createServiceGridPlan(count, serviceGridDesktopLimit(template)),
  };
}
