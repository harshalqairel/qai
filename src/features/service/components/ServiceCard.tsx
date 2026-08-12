import { Service } from "@/features/service/types";
import DeleteAction from "@/components/system/DeleteAction";
import { categoryColorCss } from "@/features/category/constants";
import { formatDuration } from "@/features/service/utils/duration";

type ServiceCardProps = {
  service: Service;
  categoryName: string;
  categoryColor: string;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => boolean | Promise<boolean>;
};

export default function ServiceCard({
  service,
  categoryName,
  categoryColor,
  onEdit,
  onDelete,
}: ServiceCardProps) {
  return (
    <div
      className="
      rounded-xl
      border
      border-zinc-200
      bg-white
      p-5 sm:p-6
      shadow-sm
    "
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {service.name}
          </h2>

          <div className="mt-3">
            <span
              className="
              inline-flex
              items-center
              rounded-full
              border border-blue-200 bg-blue-50
              px-3
              py-1
              text-sm
              font-semibold
              text-[var(--support-blue)]
              "
            >
              <span className="mr-2 size-2.5 rounded-full" style={{ backgroundColor: categoryColorCss(categoryColor, service.categoryId) }} aria-hidden="true" />
              {categoryName}
            </span>
          </div>
        </div>

        <span
          className={`rounded-full px-4 py-2 text-sm font-semibold ${
            service.active
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {service.active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="mt-8">
        <p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Rp {service.price.toLocaleString("id-ID")}
        </p>

        <p className="mt-2 text-base text-slate-500">
          {formatDuration(service.duration)}
        </p>

        {service.description && (
          <p className="mt-5 text-base leading-7 text-slate-600">
            {service.description}
          </p>
        )}
      </div>

      <div className="mt-5 flex gap-3 border-t border-border pt-5">
        <button
          type="button"
          onClick={() => onEdit(service)}
          className="
          min-h-10 rounded-lg
          border border-border bg-white
          px-4
          py-2
          font-semibold
          text-foreground
          transition
          hover:bg-muted
          "
        >
          Edit
        </button>

        <DeleteAction
          itemName="this service"
          onConfirm={() => onDelete(service)}
          successMessage="Service deleted."
          errorMessage="Could not delete the service. Try again."
        />
      </div>
    </div>
  );
}
