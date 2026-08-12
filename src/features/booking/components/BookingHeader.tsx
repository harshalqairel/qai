type BookingHeaderProps = {
  onAdd: () => void;
};

export default function BookingHeader({ onAdd }: BookingHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">Bookings</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          Track each booking, its schedules, and payments.
        </p>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="min-h-11 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-[var(--brand-hover)]"
      >
        + Add booking
      </button>
    </div>
  );
}
