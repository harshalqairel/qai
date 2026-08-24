import type { ServiceCategory } from "@/features/service-category/types";
import ListSortControl from "@/components/system/ListSortControl";

export type ServiceSort =
  | "newest"
  | "name-asc" | "name-desc"
  | "category-asc" | "category-desc"
  | "price-asc" | "price-desc"
  | "duration-asc" | "duration-desc"
  | "sessions-asc" | "sessions-desc"
  | "choices-asc" | "choices-desc"
  | "status-asc" | "status-desc";

type ServiceToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  sort: ServiceSort;
  onSortChange: (value: ServiceSort) => void;
  categories: ServiceCategory[];
};

export default function ServiceToolbar({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  categories,
}: ServiceToolbarProps) {
  return (
    <div className="filter-bar grid grid-cols-2 lg:flex">
      <input
        type="text"
        aria-label="Search services"
        placeholder="Search services..."
        className="native-control col-span-2 lg:flex-1"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
      <select
        aria-label="Filter services by category"
        className="native-control min-w-0 lg:w-auto"
        value={category}
        onChange={(event) => onCategoryChange(event.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
      <ListSortControl
        className="min-w-0 lg:w-56"
        value={sort}
        onChange={onSortChange}
        options={[
          { value: "newest", label: "Newest added" },
          { value: "name-asc", label: "Service · A–Z" },
          { value: "name-desc", label: "Service · Z–A" },
          { value: "category-asc", label: "Category · A–Z" },
          { value: "price-desc", label: "Price · highest" },
          { value: "price-asc", label: "Price · lowest" },
          { value: "duration-asc", label: "Duration · shortest" },
          { value: "duration-desc", label: "Duration · longest" },
          { value: "sessions-desc", label: "Schedules · most" },
          { value: "choices-desc", label: "Choices · most" },
          { value: "status-desc", label: "Status · active first" },
        ]}
      />
    </div>
  );
}
