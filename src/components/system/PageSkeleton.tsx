import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonProps = {
  variant: "dashboard" | "list" | "calendar" | "settings";
};

function HeaderSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

function CardRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="surface-card space-y-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function PageSkeleton({ variant }: PageSkeletonProps) {
  return (
    <div className="page-shell" role="status" aria-label="Loading page">
      <span className="sr-only">Loading…</span>
      {variant === "dashboard" && (
        <>
          <HeaderSkeleton />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />)}
          </div>
          <Skeleton className="h-72" />
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </>
      )}
      {variant === "list" && (
        <>
          <HeaderSkeleton />
          <Skeleton className="h-20" />
          <CardRows />
        </>
      )}
      {variant === "calendar" && (
        <>
          <HeaderSkeleton />
          <div className="surface-card p-4 sm:p-6">
            <Skeleton className="mb-4 h-10 w-full" />
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }, (_, index) => <Skeleton key={index} className="h-20 lg:h-28" />)}
            </div>
          </div>
        </>
      )}
      {variant === "settings" && (
        <>
          <HeaderSkeleton />
          <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            <Skeleton className="hidden h-96 lg:block" />
            <div className="surface-card p-5 sm:p-6"><CardRows count={4} /></div>
          </div>
        </>
      )}
    </div>
  );
}

