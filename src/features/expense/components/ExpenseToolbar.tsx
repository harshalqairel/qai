import { EXPENSE_TYPES } from "@/features/expense/constants";
import type { ExpenseCategory } from "@/features/expense-category/types";

type ExpenseToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  expenseType: string;
  onExpenseTypeChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
  categories: ExpenseCategory[];
};

export default function ExpenseToolbar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  expenseType,
  onExpenseTypeChange,
  sort,
  onSortChange,
  categories,
}: ExpenseToolbarProps) {
  return (
    <div className="filter-bar">
      <input
        type="text"
        placeholder="Search expenses..."
        className="native-control lg:flex-1"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <select
        className="native-control lg:w-auto"
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">All Categories</option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      <select
        className="native-control lg:w-auto"
        value={expenseType}
        onChange={(event) => onExpenseTypeChange(event.target.value)}
      >
        <option value="">All Types</option>
        {EXPENSE_TYPES.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select
        className="native-control lg:w-auto"
        value={sort}
        onChange={(event) => onSortChange(event.target.value)}
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
