import { Booking } from "@/features/booking/types";
import { DerivedPaymentStatus } from "@/features/payment/types";
import BookingCard from "./BookingCard";

type BookingWithNames = Booking & {
  customerName: string;
  serviceName: string;
  paymentStatus: DerivedPaymentStatus;
  totalPaid: number;
  remainingAmount: number;
};

type BookingListProps = {
  bookings: BookingWithNames[];
  onEdit: (booking: BookingWithNames) => void;
  onDelete: (booking: BookingWithNames) => void;
};

export default function BookingList({ bookings, onEdit, onDelete }: BookingListProps) {
  if (bookings.length === 0) {
    return (
      <div className="empty-state">
        <h3 className="text-xl font-semibold text-zinc-800">No bookings yet</h3>
        <p className="mt-2 text-zinc-500">
          Click <strong>Add Booking</strong> to create your first booking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
