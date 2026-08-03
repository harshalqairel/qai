import { Customer } from "@/features/customer/types";
import CustomerCard from "./CustomerCard";

type CustomerWithStats = Customer & {
  bookingsCount: number;
  lifetimeRevenue: number;
  outstandingBalance: number;
  upcomingBooking: string | null;
};

type CustomerListProps = {
  customers: CustomerWithStats[];
  onEdit: (customer: CustomerWithStats) => void;
  onDelete: (customer: CustomerWithStats) => void;
};

export default function CustomerList({
  customers,
  onEdit,
  onDelete,
}: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <h3 className="text-xl font-semibold text-zinc-800">No customers yet</h3>

        <p className="mt-2 text-zinc-500">
          Click <strong>Add Customer</strong> to add your first customer.
        </p>
      </div>
    );
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
