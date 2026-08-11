"use client";

import { useState } from "react";
import { MoreHorizontalIcon, PencilIcon, PhoneIcon, Trash2Icon, UsersIcon } from "lucide-react";

import DeleteAction from "@/components/system/DeleteAction";
import EmptyState from "@/components/system/EmptyState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Customer } from "@/features/customer/types";
import { formatRupiah } from "@/features/payment/utils/paymentCalculations";

type CustomerWithFinancials = Customer & {
  lifetimeRevenue: number;
  outstanding: number;
};

type CustomerTableProps = {
  customers: CustomerWithFinancials[];
  onAdd: () => void;
  onEdit: (customer: CustomerWithFinancials) => void;
  onDelete: (customer: CustomerWithFinancials) => boolean | Promise<boolean>;
};

function getWhatsAppUrl(phone: string): string | null {
  const normalizedPhone = phone.replace(/\D/g, "");

  if (!/^[1-9]\d{7,14}$/.test(normalizedPhone)) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}`;
}

type CustomerActionsProps = {
  customer: CustomerWithFinancials;
  onEdit: (customer: CustomerWithFinancials) => void;
  onDelete: (customer: CustomerWithFinancials) => boolean | Promise<boolean>;
};

function CustomerActions({ customer, onEdit, onDelete }: CustomerActionsProps) {
  const whatsAppUrl = getWhatsAppUrl(customer.phone);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Open actions for ${customer.name}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {whatsAppUrl && (
            <DropdownMenuItem
              render={<a href={whatsAppUrl} target="_blank" rel="noreferrer" />}
            >
              <PhoneIcon aria-hidden="true" />
              WhatsApp
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onEdit(customer)}>
            <PencilIcon aria-hidden="true" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteAction
        itemName="this client"
        onConfirm={() => onDelete(customer)}
        successMessage="Client deleted."
        errorMessage="Could not delete the client. Try again."
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hideTrigger
      />
    </>
  );
}

export default function CustomerTable({
  customers,
  onAdd,
  onEdit,
  onDelete,
}: CustomerTableProps) {
  if (customers.length === 0) {
    return (
      <EmptyState
        icon={UsersIcon}
        title="No clients yet."
        description="Add a client here or create one while adding a booking."
        actionLabel="Add client"
        onAction={onAdd}
      />
    );
  }

  return (
    <section aria-label="Clients">
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Client</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Unpaid amount</TableHead>
              <TableHead className="w-16 px-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="px-4 py-3 font-semibold whitespace-normal">
                  <div>
                    <p>{customer.name}</p>
                    {customer.instagram && (
                      <p className="mt-1 text-sm font-normal text-muted-foreground">
                        @{customer.instagram.replace(/^@/, "")}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-3 whitespace-normal">
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {customer.phone}
                  </a>
                  {customer.email && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {customer.email}
                    </p>
                  )}
                </TableCell>
                <TableCell className="py-3 text-right font-medium">
                  {formatRupiah(customer.lifetimeRevenue)}
                </TableCell>
                <TableCell className="py-3 text-right font-medium">
                  {formatRupiah(customer.outstanding)}
                </TableCell>
                <TableCell className="px-4 py-2 text-right">
                  <CustomerActions
                    customer={customer}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 sm:hidden">
        {customers.map((customer) => (
          <article
            key={customer.id}
            className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
          >
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-foreground">{customer.name}</h2>
              <a
                href={`tel:${customer.phone}`}
                className="mt-1 block w-fit text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
              >
                {customer.phone}
              </a>
              {customer.instagram && (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  @{customer.instagram.replace(/^@/, "")}
                </p>
              )}
              {customer.email && (
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {customer.email}
                </p>
              )}
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Income</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {formatRupiah(customer.lifetimeRevenue)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Unpaid amount</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {formatRupiah(customer.outstanding)}
                  </dd>
                </div>
              </dl>
            </div>
            <CustomerActions
              customer={customer}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
