type BookingHeaderProps = {
  onAdd: () => void;
};

export default function BookingHeader({ onAdd }: BookingHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Bookings</h1>
        <p className="mt-2 text-lg text-zinc-600">
          Manage all appointment bookings and schedule details.
        </p>
      </div>

      <button
        onClick={onAdd}
        className="rounded-xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-zinc-800"
      >
        + Add Booking
      </button>
    </div>
  );
}
