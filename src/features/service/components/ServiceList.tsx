import { Service } from "@/features/service/types";
import ServiceTable from "./ServiceTable";
import EmptyState from "@/components/system/EmptyState";
import { BriefcaseBusiness } from "lucide-react";
import type { ServiceSort } from "./ServiceToolbar";

type ServiceListProps = {
  services: Service[];
  onAdd: () => void;
  sort: ServiceSort;
  onSortChange: (value: ServiceSort) => void;
  getCategoryName: (categoryId: string) => string;
  getCategoryColor: (categoryId: string) => string;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => boolean | Promise<boolean>;
  onActiveChange: (service: Service, active: boolean) => boolean | Promise<boolean>;
};

export default function ServiceList({
  services,
  onAdd,
  sort,
  onSortChange,
  getCategoryName,
  getCategoryColor,
  onEdit,
  onDelete,
  onActiveChange,
}: ServiceListProps) {
  if (services.length === 0) {
    return <EmptyState icon={BriefcaseBusiness} title="No services yet." description="Add the services you offer." actionLabel="Add service" onAction={onAdd} />;
  }

  return <ServiceTable services={services} sort={sort} onSortChange={onSortChange} getCategoryName={getCategoryName} getCategoryColor={getCategoryColor} onEdit={onEdit} onDelete={onDelete} onActiveChange={onActiveChange} />;
}
