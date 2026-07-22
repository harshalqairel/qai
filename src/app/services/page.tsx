"use client";

import { useState } from "react";

import ServiceHeader from "@/features/service/components/ServiceHeader";
import ServiceToolbar from "@/features/service/components/ServiceToolbar";
import ServiceList from "@/features/service/components/ServiceList";
import ServiceDialog from "@/features/service/components/ServiceDialog";

import { Service } from "@/features/service/types";
import { initialServices } from "@/features/service/data";

export default function ServicesPage() {
  const [services, setServices] = useState(initialServices);

  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedService, setSelectedService] =
    useState<Service | null>(null);

  function handleCreate(service: Service) {
    setServices((prev) => [...prev, service]);

    setDialogOpen(false);
    setSelectedService(null);
  }

  function handleUpdate(updated: Service) {
    setServices((prev) =>
      prev.map((service) =>
        service.id === updated.id ? updated : service
      )
    );

    setDialogOpen(false);
    setSelectedService(null);
  }

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
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />
    </>
  );
}