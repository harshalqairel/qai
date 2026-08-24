type CustomerHeaderProps = {
  onAdd: () => void;
};

export default function CustomerHeader({ onAdd }: CustomerHeaderProps) {
  return <PageHeader title="Clients" description="Keep contact details, booking history, payments, invoices, and notes connected." actions={<Button onClick={onAdd} aria-label="+ Add client"><Plus className="size-4" />Add client</Button>} />;
}
import { Plus } from "lucide-react";
import PageHeader from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
