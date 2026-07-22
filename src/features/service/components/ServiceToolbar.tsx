import { SERVICE_CATEGORIES } from "@/features/service/constants";

export default function ServiceToolbar() {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm">

      <input
        type="text"
        placeholder="Search services..."
        className="flex-1 rounded-xl border border-zinc-300 px-4 py-2"
      />

      <select className="rounded-xl border border-zinc-300 px-4 py-2">
        <option>All Categories</option>

        {SERVICE_CATEGORIES.map((category) => (
          <option
            key={category}
            value={category}
          >
            {category}
          </option>
        ))}

      </select>

    </div>
  );
}