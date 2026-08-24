import ListSortControl from "@/components/system/ListSortControl";

export type CustomerSort =
  | "newest" | "oldest"
  | "name-asc" | "name-desc"
  | "activity-asc" | "activity-desc"
  | "paid-asc" | "paid-desc"
  | "unpaid-asc" | "unpaid-desc";

type CustomerToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  sort: CustomerSort;
  onSortChange: (value: CustomerSort) => void;
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

      <ListSortControl
        className="lg:w-52"
        value={sort}
        onChange={onSortChange}
        options={[
          { value: "newest", label: "Newest added" },
          { value: "oldest", label: "Oldest added" },
          { value: "name-asc", label: "Client · A–Z" },
          { value: "name-desc", label: "Client · Z–A" },
          { value: "activity-desc", label: "Activity · most" },
          { value: "activity-asc", label: "Activity · least" },
          { value: "paid-desc", label: "Paid · highest" },
          { value: "paid-asc", label: "Paid · lowest" },
          { value: "unpaid-desc", label: "Unpaid · highest" },
          { value: "unpaid-asc", label: "Unpaid · lowest" },
        ]}
      />
    </div>
  );
}
