"use client";

import { useState } from "react";
import { ArrowUpDown, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import DeleteAction from "@/components/system/DeleteAction";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categoryColorCss } from "@/features/category/constants";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import type { Service } from "@/features/service/types";
import { formatDuration } from "@/features/service/utils/duration";

type ServiceTableProps = {
  services: Service[];
  sort: string;
  onSortChange: (value: string) => void;
  getCategoryName: (categoryId: string) => string;
  getCategoryColor: (categoryId: string) => string;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => boolean | Promise<boolean>;
};

function ServiceActions({ service, onEdit, onDelete }: Pick<ServiceTableProps, "onEdit" | "onDelete"> & { service: Service }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Open actions for ${service.name}`} />}>
          <MoreHorizontal aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onEdit(service)}>
            <Pencil aria-hidden="true" /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden="true" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAction
        itemName="this service"
        onConfirm={() => onDelete(service)}
        successMessage="Service deleted."
        errorMessage="Could not delete the service. Try again."
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hideTrigger
      />
    </>
  );
}

function SortableHead({ label, ascending, descending, sort, onSortChange, className = "" }: {
  label: string;
  ascending: string;
  descending: string;
  sort: string;
  onSortChange: (value: string) => void;
  className?: string;
}) {
  const active = sort === ascending || sort === descending;
  return (
    <TableHead className={className} aria-sort={sort === ascending ? "ascending" : sort === descending ? "descending" : "none"}>
      <button type="button" className="inline-flex min-h-10 items-center gap-1.5 font-medium" onClick={() => onSortChange(sort === ascending ? descending : ascending)}>
        {label}
        <ArrowUpDown className={`size-3.5 ${active ? "text-foreground" : "text-muted-foreground"}`} aria-hidden="true" />
      </button>
    </TableHead>
  );
}

function Category({ name, color, id }: { name: string; color: string; id: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColorCss(color, id) }} aria-hidden="true" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export default function ServiceTable({ services, sort, onSortChange, getCategoryName, getCategoryColor, onEdit, onDelete }: ServiceTableProps) {
  const openService = (service: Service) => onEdit(service);

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:block">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableHead label="Service" ascending="name-asc" descending="name-desc" sort={sort} onSortChange={onSortChange} className="pl-4" />
              <TableHead>Category</TableHead>
              <SortableHead label="Price" ascending="price-asc" descending="price-desc" sort={sort} onSortChange={onSortChange} className="text-right" />
              <SortableHead label="Duration" ascending="duration-asc" descending="duration-desc" sort={sort} onSortChange={onSortChange} />
              <SortableHead label="Schedules" ascending="sessions-asc" descending="sessions-desc" sort={sort} onSortChange={onSortChange} className="text-center" />
              <TableHead>Status</TableHead>
              <TableHead className="pr-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow
                key={service.id}
                role="link"
                tabIndex={0}
                className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => openService(service)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openService(service);
                  }
                }}
              >
                <TableCell className="max-w-72 pl-4">
                  <p className="truncate font-semibold text-foreground">{service.name}</p>
                  {service.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{service.description}</p>}
                </TableCell>
                <TableCell className="max-w-48"><Category name={getCategoryName(service.categoryId)} color={getCategoryColor(service.categoryId)} id={service.categoryId} /></TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatRupiah(service.price)}</TableCell>
                <TableCell>{formatDuration(service.duration)}</TableCell>
                <TableCell className="text-center tabular-nums">{service.defaultSessionCount}</TableCell>
                <TableCell>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${service.active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                    {service.active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="pr-4 text-right" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <ServiceActions service={service} onEdit={onEdit} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 lg:hidden">
        {services.map((service) => (
          <article key={service.id} className="surface-card p-4" role="button" tabIndex={0} onClick={() => openService(service)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openService(service); } }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-foreground">{service.name}</h2>
                <div className="mt-1.5 text-sm text-muted-foreground"><Category name={getCategoryName(service.categoryId)} color={getCategoryColor(service.categoryId)} id={service.categoryId} /></div>
              </div>
              <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <ServiceActions service={service} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-3">
              <div>
                <p className="font-semibold tabular-nums text-foreground">{formatRupiah(service.price)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDuration(service.duration)} · {service.defaultSessionCount} {service.defaultSessionCount === 1 ? "schedule" : "schedules"}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${service.active ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{service.active ? "Active" : "Inactive"}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
