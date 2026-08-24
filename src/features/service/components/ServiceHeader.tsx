import { Plus } from "lucide-react";

import PageHeader from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";

type ServiceHeaderProps = {
  onAdd: () => void;
};

export default function ServiceHeader({
  onAdd,
}: ServiceHeaderProps) {
  return (
    <PageHeader
      title="Services"
      description="Manage what clients can book, including prices, schedules, and optional choices."
      actions={<Button onClick={onAdd} aria-label="+ Add service"><Plus className="size-4" />Add service</Button>}
    />
  );
}
