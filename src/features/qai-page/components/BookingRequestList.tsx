"use client";

import { useMemo, useState } from "react";
import { Check, Eye, FilePenLine, MessageCircle, RefreshCw, X } from "lucide-react";
import ListSortControl from "@/components/system/ListSortControl";
import RowActionsMenu, { type RowAction } from "@/components/system/RowActionsMenu";
import SortableTableHeader from "@/components/system/SortableTableHeader";
import StatusBadge from "@/components/system/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeContactPhone, type PublicRequest } from "@/features/qai-page/validation";

export type RequestFilter = "Pending" | "Accepted" | "Declined" | "All";
type RequestSort = "submitted-desc" | "submitted-asc" | "client-asc" | "client-desc" | "service-asc" | "service-desc" | "date-asc" | "date-desc" | "status-asc" | "status-desc";

type Props = {
  requests: PublicRequest[];
  filter: RequestFilter;
  onFilterChange: (filter: RequestFilter) => void;
  onRefresh: () => void;
  onAccept: (request: PublicRequest) => void;
  onReview: (request: PublicRequest) => void;
  onDecline: (request: PublicRequest) => void;
};

function submittedLabel(value: number) {
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function requestedDate(request: PublicRequest) {
  return [...request.schedules].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))[0]?.date ?? "";
}

function requestStatusTone(status: PublicRequest["status"]): "success" | "warning" | "danger" {
  return status === "Accepted" ? "success" : status === "Declined" ? "danger" : "warning";
}

export default function BookingRequestList({ requests, filter, onFilterChange, onRefresh, onAccept, onReview, onDecline }: Props) {
  const [sort, setSort] = useState<RequestSort>("submitted-desc");
  const rows = useMemo(() => {
    const visible = requests.filter((request) => filter === "All" || request.status === filter);
    switch (sort) {
      case "submitted-asc": return visible.sort((a, b) => a.submittedAt - b.submittedAt);
      case "client-asc": return visible.sort((a, b) => a.clientName.localeCompare(b.clientName));
      case "client-desc": return visible.sort((a, b) => b.clientName.localeCompare(a.clientName));
      case "service-asc": return visible.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
      case "service-desc": return visible.sort((a, b) => b.serviceName.localeCompare(a.serviceName));
      case "date-asc": return visible.sort((a, b) => requestedDate(a).localeCompare(requestedDate(b)));
      case "date-desc": return visible.sort((a, b) => requestedDate(b).localeCompare(requestedDate(a)));
      case "status-asc": return visible.sort((a, b) => a.status.localeCompare(b.status));
      case "status-desc": return visible.sort((a, b) => b.status.localeCompare(a.status));
      case "submitted-desc":
      default: return visible.sort((a, b) => b.submittedAt - a.submittedAt);
    }
  }, [filter, requests, sort]);

  function actions(request: PublicRequest): RowAction[] {
    const items: RowAction[] = [];
    if (request.bookingId) items.push({ label: "View booking", icon: Eye, href: `/bookings?booking=${request.bookingId}` });
    if (!request.bookingId && request.status !== "Declined") {
      items.push({ label: request.type === "Inquiry" ? "Review & create booking" : request.type === "Instant booking" ? "Review owner booking" : "Review & accept", icon: FilePenLine, onSelect: () => onReview(request) });
    }
    items.push({ label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/${normalizeContactPhone(request.whatsapp)}`, target: "_blank" });
    if (!request.bookingId && request.type === "Booking request" && request.status === "Pending") items.push({ label: "Accept now", icon: Check, onSelect: () => onAccept(request) });
    if (request.status === "Pending") items.push({ label: "Decline request", icon: X, onSelect: () => onDecline(request), destructive: true, separatorBefore: true });
    return items;
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="section-title">Booking requests</h2><p className="mt-1 text-sm text-muted-foreground">Review the original submission before creating or changing a booking.</p></div>
        <Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="size-4" /> Refresh</Button>
      </div>
      <div className="filter-bar flex-col lg:flex-row lg:items-center">
        <div className="grid w-full grid-cols-4 gap-1 lg:flex lg:flex-1 lg:gap-2" role="group" aria-label="Request status filter">
          {(["Pending", "Accepted", "Declined", "All"] as const).map((status) => <button key={status} type="button" onClick={() => onFilterChange(status)} className={`min-h-10 min-w-0 rounded-lg px-1 text-xs font-semibold sm:px-3 sm:text-sm ${filter === status ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}>{status} <span className="ml-0.5 tabular-nums sm:ml-1">{status === "All" ? requests.length : requests.filter((request) => request.status === status).length}</span></button>)}
        </div>
        <ListSortControl className="w-full lg:w-56" value={sort} onChange={setSort} options={[{ value: "submitted-desc", label: "Submitted · latest" }, { value: "submitted-asc", label: "Submitted · earliest" }, { value: "client-asc", label: "Client · A–Z" }, { value: "service-asc", label: "Service · A–Z" }, { value: "date-asc", label: "Requested date · earliest" }, { value: "status-asc", label: "Status · A–Z" }]} />
      </div>

      {requests.length === 0 ? <div className="empty-state"><p className="empty-title">No requests yet</p><p className="mt-2 text-sm text-muted-foreground">Share your Qai Page link to receive a request.</p></div> : rows.length === 0 ? <div className="empty-state"><p className="empty-title">No {filter.toLowerCase()} requests</p><p className="mt-2 text-sm text-muted-foreground">Choose another status to review request history.</p></div> : <>
        <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:block">
          <Table>
            <TableHeader><TableRow>
              <SortableTableHeader className="px-4" label="Submitted" sort={sort} ascending="submitted-asc" descending="submitted-desc" onSortChange={setSort} />
              <SortableTableHeader label="Client" sort={sort} ascending="client-asc" descending="client-desc" onSortChange={setSort} />
              <SortableTableHeader label="Service" sort={sort} ascending="service-asc" descending="service-desc" onSortChange={setSort} />
              <SortableTableHeader label="Requested date" sort={sort} ascending="date-asc" descending="date-desc" onSortChange={setSort} />
              <SortableTableHeader label="Status" sort={sort} ascending="status-asc" descending="status-desc" onSortChange={setSort} />
              <TableHead className="w-20 px-4 text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>{rows.map((request) => <TableRow key={request.id}>
              <TableCell className="px-4 py-3"><p className="font-medium">{submittedLabel(request.submittedAt)}</p></TableCell>
              <TableCell className="py-3 whitespace-normal"><p className="font-semibold">{request.clientName}</p><p className="mt-1 text-xs text-muted-foreground">{request.whatsapp}</p></TableCell>
              <TableCell className="py-3 whitespace-normal"><p className="font-medium">{request.serviceName}</p>{request.serviceSnapshot?.variantLabel && <p className="mt-1 text-xs text-muted-foreground">{request.serviceSnapshot.variantLabel}</p>}</TableCell>
              <TableCell className="py-3">{requestedDate(request) || "—"}<p className="mt-1 text-xs text-muted-foreground">{request.schedules.length ? `${request.schedules.length} ${request.schedules.length === 1 ? "schedule" : "schedules"}` : "Not provided"}</p></TableCell>
              <TableCell className="py-3"><StatusBadge tone={requestStatusTone(request.status)}>{request.status}</StatusBadge><p className="mt-1 text-xs text-muted-foreground">{request.type}</p></TableCell>
              <TableCell className="px-4 py-2 text-right"><RowActionsMenu recordLabel={`${request.clientName}'s request`} actions={actions(request)} /></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="space-y-3 xl:hidden">{rows.map((request) => <article key={request.id} className="surface-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{request.clientName}</h3><StatusBadge tone={requestStatusTone(request.status)}>{request.status}</StatusBadge></div><p className="mt-1 truncate text-sm text-muted-foreground">{request.serviceName}{request.serviceSnapshot?.variantLabel ? ` · ${request.serviceSnapshot.variantLabel}` : ""}</p></div><RowActionsMenu recordLabel={`${request.clientName}'s request`} actions={actions(request)} /></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm"><div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="mt-1 font-medium">{submittedLabel(request.submittedAt)}</dd></div><div><dt className="text-xs text-muted-foreground">Requested</dt><dd className="mt-1 font-medium">{requestedDate(request) || "Not provided"}</dd></div></dl>{(request.need || request.notes) && <p className="mt-3 line-clamp-3 rounded-lg bg-muted/45 p-3 text-sm">{[request.need, request.notes].filter(Boolean).join(" · ")}</p>}</article>)}</div>
      </>}
    </section>
  );
}
