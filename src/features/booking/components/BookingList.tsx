import { Booking } from "@/features/booking/types";
import { DerivedPaymentStatus } from "@/features/payment/types";
import BookingCard from "./BookingCard";
import EmptyState from "@/components/system/EmptyState";
import { CalendarDays } from "lucide-react";

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
  onDelete: (booking: BookingWithNames) => boolean;
};

export default function BookingList({ bookings, onEdit, onDelete }: BookingListProps) {
  if (bookings.length === 0) {
    return <EmptyState icon={CalendarDays} title="No bookings yet." description="Add a booking when you are ready." />;
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
