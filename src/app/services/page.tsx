"use client";

import { useState } from "react";

import ServiceHeader from "@/features/service/components/ServiceHeader";
import ServiceToolbar from "@/features/service/components/ServiceToolbar";
import ServiceList from "@/features/service/components/ServiceList";
import ServiceDialog from "@/features/service/components/ServiceDialog";

import { Service, CreateServiceInput } from "@/features/service/types";
import { useServices } from "@/features/service/hooks/useServices";

export default function ServicesPage() {
  const { services, createService, updateService, deleteService } = useServices();

  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedService, setSelectedService] =
    useState<Service | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const keyword = search.trim().toLowerCase();

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      keyword === "" ||
      service.name.toLowerCase().includes(keyword) ||
      service.category.toLowerCase().includes(keyword) ||
      service.description.toLowerCase().includes(keyword);

    const matchesCategory = category === "" || service.category === category;

    return matchesSearch && matchesCategory;
  });

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

          <ServiceToolbar
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
          />

          <ServiceList
            services={filteredServices}
            onEdit={(service) => {
              setSelectedService(service);
              setDialogOpen(true);
            }}
            onDelete={(service) => deleteService(service.id)}
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