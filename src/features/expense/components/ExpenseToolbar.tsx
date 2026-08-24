import { EXPENSE_TYPES } from "@/features/expense/constants";
import type { ExpenseCategory } from "@/features/expense-category/types";
import ListSortControl from "@/components/system/ListSortControl";

export type ExpenseSort =
  | "newest" | "oldest"
  | "date-asc" | "date-desc"
  | "category-asc" | "category-desc"
  | "target-asc" | "target-desc"
  | "payment-asc" | "payment-desc"
  | "amount-asc" | "amount-desc";

type ExpenseToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  expenseType: string;
  onExpenseTypeChange: (value: string) => void;
  sort: ExpenseSort;
  onSortChange: (value: ExpenseSort) => void;
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
    <div className="filter-bar grid grid-cols-2 lg:flex">
      <input
        type="text"
        placeholder="Search expenses..."
        className="native-control col-span-2 lg:flex-1"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <select
        className="native-control min-w-0 lg:w-auto"
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      <select
        className="native-control min-w-0 lg:w-auto"
        value={expenseType}
        onChange={(event) => onExpenseTypeChange(event.target.value)}
      >
        <option value="">All types</option>
        {EXPENSE_TYPES.map((type) => (
          <option key={type} value={type}>{type === "Business Expense" ? "General expense" : "Booking expense"}</option>
        ))}
      </select>
      <ListSortControl
        className="col-span-2 lg:w-56"
        value={sort}
        onChange={onSortChange}
        options={[
          { value: "newest", label: "Newest added" },
          { value: "oldest", label: "Oldest added" },
          { value: "date-desc", label: "Date · latest" },
          { value: "date-asc", label: "Date · earliest" },
          { value: "category-asc", label: "Category · A–Z" },
          { value: "target-asc", label: "Booking / paid to · A–Z" },
          { value: "payment-asc", label: "Payment method · A–Z" },
          { value: "amount-desc", label: "Amount · highest" },
          { value: "amount-asc", label: "Amount · lowest" },
        ]}
      />
    </div>
  );
}
