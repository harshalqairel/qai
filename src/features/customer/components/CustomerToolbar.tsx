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
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">

      <input
        type="text"
        placeholder="Search customers..."
        className="flex-1 rounded-xl border border-zinc-300 px-4 py-2"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <select
        className="rounded-xl border border-zinc-300 px-4 py-2"
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
