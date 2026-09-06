"use client";

import { useState } from "react";
import { CircleCheck, CircleOff, LoaderCircle, Pencil, Trash2 } from "lucide-react";

import DeleteAction from "@/components/system/DeleteAction";
import StatusBadge from "@/components/system/StatusBadge";
import RowActionsMenu from "@/components/system/RowActionsMenu";
import SortableTableHeader from "@/components/system/SortableTableHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categoryColorCss } from "@/features/category/constants";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";
import type { Service } from "@/features/service/types";
import { formatDuration } from "@/features/service/utils/duration";
import type { ServiceSort } from "./ServiceToolbar";
import { useActionGuard } from "@/hooks/useActionGuard";
import { notify } from "@/lib/notifications";

type ServiceTableProps = {
  services: Service[];
  sort: ServiceSort;
  onSortChange: (value: ServiceSort) => void;
  getCategoryName: (categoryId: string) => string;
  getCategoryColor: (categoryId: string) => string;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => boolean | Promise<boolean>;
  onActiveChange: (service: Service, active: boolean) => boolean | Promise<boolean>;
};

function ServiceActions({ service, onEdit, onDelete, onActiveChange }: Pick<ServiceTableProps, "onEdit" | "onDelete" | "onActiveChange"> & { service: Service }) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const action = useActionGuard();

  async function setActive(active: boolean) {
    const succeeded = await action.run(() => onActiveChange(service, active));
    if (!succeeded) {
      notify.error(`Could not ${active ? "activate" : "deactivate"} the service. Try again.`);
      return;
    }
    notify.success(active ? "Service activated." : "Service deactivated.");
    setDeactivateOpen(false);
  }

  return (
    <>
      <RowActionsMenu
        recordLabel={service.name}
        actions={[
          { label: "Edit service", icon: Pencil, onSelect: () => onEdit(service) },
          service.active
            ? { label: "Deactivate service", icon: CircleOff, onSelect: () => setDeactivateOpen(true), disabled: action.pending }
            : { label: "Activate service", icon: CircleCheck, onSelect: () => void setActive(true), disabled: action.pending },
          { label: "Delete service", icon: Trash2, onSelect: () => setDeleteOpen(true), destructive: true, separatorBefore: true },
        ]}
      />
      <DeleteAction
        itemName="this service"
        onConfirm={() => onDelete(service)}
        successMessage="Service deleted."
        errorMessage="Could not delete the service. Try again."
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hideTrigger
      />
      <AlertDialog open={deactivateOpen} onOpenChange={(open) => { if (!action.pending) setDeactivateOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate this service?</AlertDialogTitle>
            <AlertDialogDescription>It will no longer be available for new bookings. Existing bookings and history will stay unchanged.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={action.pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction type="button" disabled={action.pending} onClick={() => void setActive(false)}>
              {action.pending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              {action.pending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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

export default function ServiceTable({ services, sort, onSortChange, getCategoryName, getCategoryColor, onEdit, onDelete, onActiveChange }: ServiceTableProps) {
  const openService = (service: Service) => onEdit(service);

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:block">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <SortableTableHeader label="Service" ascending="name-asc" descending="name-desc" sort={sort} onSortChange={onSortChange} className="pl-4" />
              <SortableTableHeader label="Category" ascending="category-asc" descending="category-desc" sort={sort} onSortChange={onSortChange} />
              <SortableTableHeader label="Price" ascending="price-asc" descending="price-desc" sort={sort} onSortChange={onSortChange} align="right" />
              <SortableTableHeader label="Duration" ascending="duration-asc" descending="duration-desc" sort={sort} onSortChange={onSortChange} />
              <SortableTableHeader label="Schedules" ascending="sessions-asc" descending="sessions-desc" sort={sort} onSortChange={onSortChange} />
              <SortableTableHeader label="Choices" ascending="choices-asc" descending="choices-desc" sort={sort} onSortChange={onSortChange} />
              <SortableTableHeader label="Status" ascending="status-asc" descending="status-desc" sort={sort} onSortChange={onSortChange} />
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
                <TableCell className="text-center tabular-nums">{service.variants?.filter((choice) => choice.active).length || "—"}</TableCell>
                <TableCell>
                  <StatusBadge tone={service.active ? "success" : "neutral"}>{service.active ? "Active" : "Inactive"}</StatusBadge>
                </TableCell>
                <TableCell className="pr-4 text-right" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                  <ServiceActions service={service} onEdit={onEdit} onDelete={onDelete} onActiveChange={onActiveChange} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 xl:hidden">
        {services.map((service) => (
          <article key={service.id} className="surface-card p-4" role="button" tabIndex={0} onClick={() => openService(service)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openService(service); } }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-foreground">{service.name}</h2>
                <div className="mt-1.5 text-sm text-muted-foreground"><Category name={getCategoryName(service.categoryId)} color={getCategoryColor(service.categoryId)} id={service.categoryId} /></div>
              </div>
              <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <ServiceActions service={service} onEdit={onEdit} onDelete={onDelete} onActiveChange={onActiveChange} />
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4 border-t border-border pt-3">
              <div>
                <p className="font-semibold tabular-nums text-foreground">{formatRupiah(service.price)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDuration(service.duration)} · {service.defaultSessionCount} {service.defaultSessionCount === 1 ? "schedule" : "schedules"}{service.variants?.some((choice) => choice.active) ? ` · ${service.variants.filter((choice) => choice.active).length} choices` : ""}</p>
              </div>
              <StatusBadge tone={service.active ? "success" : "neutral"}>{service.active ? "Active" : "Inactive"}</StatusBadge>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
