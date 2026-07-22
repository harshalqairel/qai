import { Service } from "@/features/service/types";
import ServiceCard from "./ServiceCard";

type ServiceListProps = {
  services: Service[];
  onEdit: (service: Service) => void;
};

export default function ServiceList({
  services,
  onEdit,
}: ServiceListProps) {
  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center">
        <h3 className="text-xl font-semibold text-zinc-800">
          No services yet
        </h3>

        <p className="mt-2 text-zinc-500">
          Click <strong>Add Service</strong> to create your first service.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}