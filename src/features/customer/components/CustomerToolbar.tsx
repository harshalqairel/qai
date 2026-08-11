type CustomerToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  sort: string;
  onSortChange: (value: string) => void;
};

export default function CustomerToolbar({
  search,
  onSearchChange,
  sort,
  onSortChange,
}: CustomerToolbarProps) {
  return (
    <div className="filter-bar">

      <input
        type="text"
        placeholder="Search clients..."
        className="native-control lg:flex-1"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select
        className="native-control lg:w-auto"
        value={sort}
        onChange={(e) => onSortChange(e.target.value)}
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
      </select>
    </div>
  );
}
