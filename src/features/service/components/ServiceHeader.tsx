type ServiceHeaderProps = {
  onAdd: () => void;
};

export default function ServiceHeader({
  onAdd,
}: ServiceHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

      <div>

        <h1 className="page-title">
          Services
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Manage all services offered by your business.
        </p>

      </div>

      <button
        onClick={onAdd}
        className="
        min-h-11 rounded-lg
        bg-primary
        px-5
        py-2.5
        font-semibold
        text-white
        transition
        shadow-sm hover:bg-[var(--brand-hover)]
        "
      >
        + Add Service
      </button>

    </div>
  );
}
