type ExpenseHeaderProps = { onAdd: () => void };

export default function ExpenseHeader({ onAdd }: ExpenseHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">Expenses</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">Track all business and booking expenses.</p>
      </div>
      <button
        onClick={onAdd}
        className="min-h-11 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--brand-hover)]"
      >
        + Add Expense
      </button>
    </div>
  );
}
