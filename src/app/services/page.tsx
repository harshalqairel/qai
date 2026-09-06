"use client";

import { useState } from "react";

import ServiceHeader from "@/features/service/components/ServiceHeader";
import ServiceToolbar from "@/features/service/components/ServiceToolbar";
import type { ServiceSort } from "@/features/service/components/ServiceToolbar";
import ServiceList from "@/features/service/components/ServiceList";
import ServiceDialog from "@/features/service/components/ServiceDialog";

import { Service } from "@/features/service/types";
import { serviceCreateInputFromRecord } from "@/features/service/domain/serviceCreateInput";
import { filterServices, type ServiceStatusFilter } from "@/features/service/domain/serviceFilters";
import { useServices } from "@/features/service/hooks/useServices";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";
import PageSkeleton from "@/components/system/PageSkeleton";
import DataErrorState from "@/components/system/DataErrorState";

export default function ServicesPage() {
  const serviceData = useServices();
  const categoryData = useServiceCategories();
  const { services, createService, updateService, deleteService } = serviceData;
  const { categories } = categoryData;

  const [dialogOpen, setDialogOpen] = useState(false);

  const [selectedService, setSelectedService] =
    useState<Service | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<ServiceStatusFilter>("all");
  const [sort, setSort] = useState<ServiceSort>("newest");

  const categoryNameById = new Map(categories.map((item) => [item.id, item.name]));
  const categoryColorById = new Map(categories.map((item) => [item.id, item.color]));

  const filteredServices = filterServices(services, {
    search,
    categoryId: category,
    status,
    categoryNameById,
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

  case "category-asc":
    sortedServices.sort((a, b) => (categoryNameById.get(a.categoryId) ?? "").localeCompare(categoryNameById.get(b.categoryId) ?? ""));
    break;

  case "category-desc":
    sortedServices.sort((a, b) => (categoryNameById.get(b.categoryId) ?? "").localeCompare(categoryNameById.get(a.categoryId) ?? ""));
    break;

  case "sessions-asc":
    sortedServices.sort((a, b) => a.defaultSessionCount - b.defaultSessionCount);
    break;

  case "sessions-desc":
    sortedServices.sort((a, b) => b.defaultSessionCount - a.defaultSessionCount);
    break;

  case "choices-asc":
    sortedServices.sort((a, b) => (a.variants?.filter((item) => item.active).length ?? 0) - (b.variants?.filter((item) => item.active).length ?? 0));
    break;

  case "choices-desc":
    sortedServices.sort((a, b) => (b.variants?.filter((item) => item.active).length ?? 0) - (a.variants?.filter((item) => item.active).length ?? 0));
    break;

  case "status-desc":
    sortedServices.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
    break;

  case "status-asc":
    sortedServices.sort((a, b) => Number(a.active) - Number(b.active) || a.name.localeCompare(b.name));
    break;

  default:
    // Newest (keep insertion order)
    break;
  }

  if (serviceData.isLoading || categoryData.isLoading) return <main className="min-h-screen"><PageSkeleton variant="list" /></main>;
  if (serviceData.loadError || categoryData.loadError) return (
    <main className="min-h-screen"><div className="page-shell"><DataErrorState onRetry={() => { serviceData.retry(); categoryData.retry(); }} /></div></main>
  );

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
            status={status}
            onStatusChange={setStatus}
            sort={sort}
            onSortChange={setSort}
            categories={categories}
          />

          <ServiceList
            services={sortedServices}
            sort={sort}
            onSortChange={setSort}
            onAdd={() => {
              setSelectedService(null);
              setDialogOpen(true);
            }}
            getCategoryName={(categoryId) => categoryNameById.get(categoryId) ?? "Category not found"}
            getCategoryColor={(categoryId) => categoryColorById.get(categoryId) ?? "category-slate"}
            onEdit={(service) => {
              setSelectedService(service);
              setDialogOpen(true);
            }}
            onDelete={(service) => deleteService(service.id)}
            onActiveChange={(service, active) => updateService({ ...service, active })}
          />

        </div>
      </main>

      <ServiceDialog
        open={dialogOpen}
        service={selectedService}
        categories={categories}
        onQuickCreateCategory={(input) => categoryData.createCategoryAndReturn(input)}
        onClose={() => {
          setDialogOpen(false);
          setSelectedService(null);
        }}
        onCreate={(service: Service) => {
          return createService(serviceCreateInputFromRecord(service));
        }}
        onUpdate={(updated: Service) => updateService(updated)}
      />
    </>
  );
}
