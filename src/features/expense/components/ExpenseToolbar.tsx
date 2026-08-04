import { EXPENSE_CATEGORIES, EXPENSE_TYPES } from "@/features/expense/constants";

type ExpenseToolbarProps = {
  search: string;
  onSearchChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  expenseType: string;
  onExpenseTypeChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
};

export default function ExpenseToolbar({
  search, onSearchChange,
  category, onCategoryChange,
  expenseType, onExpenseTypeChange,
  sort, onSortChange,
}: ExpenseToolbarProps) {
  return (
    <div className="filter-bar">
      <input
        type="text"
        placeholder="Search expenses..."
        className="w-full rounded-xl border border-zinc-300 px-4 py-2 lg:flex-1"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select
        className="rounded-xl border border-zinc-300 px-4 py-2"
        value={category}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">All Categories</option>
        {EXPENSE_CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <select
        className="rounded-xl border border-zinc-300 px-4 py-2"
        value={expenseType}
        onChange={(e) => onExpenseTypeChange(e.target.value)}
      >
        <option value="">All Types</option>
        {EXPENSE_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <select
        className="rounded-xl border border-zinc-300 px-4 py-2"
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="date-asc">Date (Oldest First)</option>
        <option value="date-desc">Date (Newest First)</option>
        <option value="amount-asc">Amount (Low → High)</option>
        <option value="amount-desc">Amount (High → Low)</option>
      </select>
    </div>
  );
}
