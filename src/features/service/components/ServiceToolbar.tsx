import type { ServiceCategory } from "@/features/service-category/types";

type ServiceToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
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
    <div className="filter-bar">
      <input
        type="text"
        placeholder="Search services..."
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
        value={sort}
        onChange={(event) => onSortChange(event.target.value)}
      >
        <option value="">Newest</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="price-asc">Price (Low → High)</option>
        <option value="price-desc">Price (High → Low)</option>
        <option value="duration-asc">Duration (Short → Long)</option>
        <option value="duration-desc">Duration (Long → Short)</option>
      </select>
    </div>
  );
}
