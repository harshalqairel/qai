"use client";

import { useState } from "react";

import ServiceHeader from "@/features/service/components/ServiceHeader";
import ServiceToolbar from "@/features/service/components/ServiceToolbar";
import ServiceList from "@/features/service/components/ServiceList";
import ServiceDialog from "@/features/service/components/ServiceDialog";

import { Service, CreateServiceInput } from "@/features/service/types";
import { useServices } from "@/features/service/hooks/useServices";

export default function ServicesPage() {
  const { services, createService, updateService } = useServices();

  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedService, setSelectedService] =
    useState<Service | null>(null);

  return (
    <>
      <main className="min-h-screen bg-zinc-100">
        <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">

          <ServiceHeader
            onAdd={() => {
              setSelectedService(null);
              setDialogOpen(true);
            }}
          />

          <ServiceToolbar />

          <ServiceList
            services={services}
            onEdit={(service) => {
              setSelectedService(service);
              setDialogOpen(true);
            }}
          />

        </div>
      </main>

      <ServiceDialog
        open={dialogOpen}
        service={selectedService}
        onClose={() => {
          setDialogOpen(false);
          setSelectedService(null);
        }}
        onCreate={(service: Service) => {
          const input: CreateServiceInput = {
            name: service.name,
            category: service.category,
            price: service.price,
            duration: service.duration,
            description: service.description,
          };

          createService(input);

          setDialogOpen(false);
          setSelectedService(null);
        }}
        onUpdate={(updated: Service) => {
          updateService(updated);

          setDialogOpen(false);
          setSelectedService(null);
        }}
      />
    </>
  );
}