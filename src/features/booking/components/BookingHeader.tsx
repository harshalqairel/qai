type BookingHeaderProps = {
  onAdd: () => void;
};

export default function BookingHeader({ onAdd }: BookingHeaderProps) {
  return <PageHeader title="Bookings" description="Track every client job, schedule, payment, invoice, and result in one place." actions={<Button onClick={onAdd} aria-label="+ Add booking"><Plus className="size-4" />Add booking</Button>} />;
}
import { Plus } from "lucide-react";
import PageHeader from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
