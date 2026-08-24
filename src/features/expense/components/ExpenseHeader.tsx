type ExpenseHeaderProps = { onAdd: () => void };

export default function ExpenseHeader({ onAdd }: ExpenseHeaderProps) {
  return <PageHeader title="Expenses" description="Record business costs clearly and keep booking expenses tied to the right job." actions={<Button onClick={onAdd} aria-label="+ Add expense"><Plus className="size-4" />Add expense</Button>} />;
}
import { Plus } from "lucide-react";
import PageHeader from "@/components/system/PageHeader";
import { Button } from "@/components/ui/button";
