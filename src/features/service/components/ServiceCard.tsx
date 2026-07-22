import { Service } from "@/features/service/types";

type ServiceCardProps = {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
};

export default function ServiceCard({
  service,
  onEdit,
  onDelete,
}: ServiceCardProps) {
  return (
    <div
      className="
      rounded-3xl
      border
      border-zinc-200
      bg-white
      p-7
      shadow-sm
      transition-all
      duration-200
      hover:-translate-y-1
      hover:shadow-xl
    "
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {service.name}
          </h2>

          <div className="mt-3">
            <span
              className="
              inline-flex
              items-center
              rounded-full
              bg-pink-100
              px-3
              py-1
              text-sm
              font-semibold
              text-pink-700
              "
            >
              {service.category}
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
        <p className="text-5xl font-bold tracking-tight text-slate-900">
          Rp {service.price.toLocaleString("id-ID")}
        </p>

        <p className="mt-2 text-base text-slate-500">
          {service.duration} minutes
        </p>

        {service.description && (
          <p className="mt-5 text-base leading-7 text-slate-600">
            {service.description}
          </p>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        <button
          onClick={() => onEdit(service)}
          className="
          rounded-xl
          bg-slate-900
          px-5
          py-3
          font-semibold
          text-white
          transition
          hover:bg-slate-700
          "
        >
          Edit
        </button>

        <button
          onClick={() => onDelete(service)}
          className="
          rounded-xl
          border
          border-red-300
          bg-white
          px-5
          py-3
          font-semibold
          text-red-600
          transition
          hover:bg-red-50
          "
        >
          Delete
        </button>
      </div>
    </div>
  );
}