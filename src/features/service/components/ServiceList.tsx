import { Service } from "@/features/service/types";
import ServiceCard from "./ServiceCard";
import EmptyState from "@/components/system/EmptyState";
import { BriefcaseBusiness } from "lucide-react";

type ServiceListProps = {
  services: Service[];
  getCategoryName: (categoryId: string) => string;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => boolean | Promise<boolean>;
};

export default function ServiceList({
  services,
  getCategoryName,
  onEdit,
  onDelete,
}: ServiceListProps) {
  if (services.length === 0) {
    return <EmptyState icon={BriefcaseBusiness} title="No services yet." description="Add a service when you are ready." />;
  }

  return (
    <div className="space-y-6">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          categoryName={getCategoryName(service.categoryId)}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
