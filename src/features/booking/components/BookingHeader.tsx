import { Plus } from "lucide-react";
import PageHeader from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";

type BookingHeaderProps = {
  onAdd: () => void;
  selectionMode?: boolean;
  onToggleSelectionMode?: () => void;
};

export default function BookingHeader({ onAdd, selectionMode = false, onToggleSelectionMode }: BookingHeaderProps) {
  return <PageHeader title="Bookings" description="Track every client job, schedule, payment, invoice, and result in one place." actions={<>{onToggleSelectionMode && <Button type="button" variant="outline" className="xl:hidden" onClick={onToggleSelectionMode}>{selectionMode ? "Cancel selection" : "Select"}</Button>}<Button onClick={onAdd} aria-label="+ Add booking"><Plus className="size-4" />Add booking</Button></>} />;
}
