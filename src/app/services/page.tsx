"use client";

import { useState } from "react";

import ServiceHeader from "@/features/service/components/ServiceHeader";
import ServiceToolbar from "@/features/service/components/ServiceToolbar";
import ServiceList from "@/features/service/components/ServiceList";
import ServiceDialog from "@/features/service/components/ServiceDialog";

import { Service, CreateServiceInput } from "@/features/service/types";
import { useServices } from "@/features/service/hooks/useServices";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";

export default function ServicesPage() {
  const { services, createService, updateService, deleteService } = useServices();
  const { categories } = useServiceCategories();

  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedService, setSelectedService] =
    useState<Service | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");

  const keyword = search.trim().toLowerCase();
  const categoryNameById = new Map(categories.map((item) => [item.id, item.name]));

  const filteredServices = services.filter((service) => {
    const matchesSearch =
      keyword === "" ||
      service.name.toLowerCase().includes(keyword) ||
      (categoryNameById.get(service.categoryId) ?? "Category not found").toLowerCase().includes(keyword) ||
      service.description.toLowerCase().includes(keyword);

    const matchesCategory = category === "" || service.categoryId === category;

    return matchesSearch && matchesCategory;
  });

  const sortedServices = [...filteredServices];

  switch (sort) {
  case "name-asc":
    sortedServices.sort((a, b) => a.name.localeCompare(b.name));
    break;

  case "name-desc":
    sortedServices.sort((a, b) => b.name.localeCompare(a.name));
    break;

  case "price-asc":
    sortedServices.sort((a, b) => a.price - b.price);
    break;

  case "price-desc":
    sortedServices.sort((a, b) => b.price - a.price);
    break;

  case "duration-asc":
    sortedServices.sort((a, b) => a.duration - b.duration);
    break;

  case "duration-desc":
    sortedServices.sort((a, b) => b.duration - a.duration);
    break;

  default:
    // Newest (keep insertion order)
    break;
  }

  return (
    <>
      <main className="min-h-screen">
        <div className="page-shell">

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
            sort={sort}
            onSortChange={setSort}
            categories={categories}
          />

          <ServiceList
            services={sortedServices}
            getCategoryName={(categoryId) => categoryNameById.get(categoryId) ?? "Category not found"}
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
        categories={categories}
        onClose={() => {
          setDialogOpen(false);
          setSelectedService(null);
        }}
        onCreate={(service: Service) => {
          const input: CreateServiceInput = {
            name: service.name,
            categoryId: service.categoryId,
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
