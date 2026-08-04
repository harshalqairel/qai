import { Customer } from "@/features/customer/types";
import CustomerCard from "./CustomerCard";
import EmptyState from "@/components/system/EmptyState";
import { Users } from "lucide-react";

type CustomerWithStats = Customer & {
  bookingsCount: number;
  lifetimeRevenue: number;
  outstandingBalance: number;
  upcomingBooking: string | null;
};

type CustomerListProps = {
  customers: CustomerWithStats[];
  onEdit: (customer: CustomerWithStats) => void;
  onDelete: (customer: CustomerWithStats) => boolean;
};

export default function CustomerList({
  customers,
  onEdit,
  onDelete,
}: CustomerListProps) {
  if (customers.length === 0) {
    return <EmptyState icon={Users} title="No customers yet." description="Add a customer when you are ready." />;
  }

  return (
    <div className="space-y-6">
      {customers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
