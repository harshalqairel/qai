"use client";

import { useEffect, useState } from "react";

import {
  Service,
  ServiceCategory,
} from "@/features/service/types";

import {
  SERVICE_CATEGORIES,
} from "@/features/service/constants";

type ServiceDialogProps = {
  open: boolean;
  service: Service | null;
  onClose: () => void;
  onCreate: (service: Service) => void;
  onUpdate: (service: Service) => void;
};

const INITIAL_CATEGORY = ServiceCategory.WEDDING;

export default function ServiceDialog({
  open,
  service,
  onClose,
  onCreate,
  onUpdate,
}: ServiceDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(INITIAL_CATEGORY);
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [description, setDescription] = useState("");

  const isEdit = service !== null;

  useEffect(() => {
    if (!open) return;

    if (service) {
      setName(service.name);
      setCategory(service.category);
      setPrice(service.price.toString());
      setDuration(service.duration.toString());
      setDescription(service.description);
      return;
    }

    resetForm();
  }, [open, service]);

  function resetForm() {
    setName("");
    setCategory(INITIAL_CATEGORY);
    setPrice("");
    setDuration("");
    setDescription("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleSave() {
    if (!name.trim()) {
      alert("Service name is required.");
      return;
    }

    if (Number(price) <= 0) {
      alert("Price must be greater than 0.");
      return;
    }

    if (Number(duration) <= 0) {
      alert("Duration must be greater than 0.");
      return;
    }

    const data: Service = {
      id: service?.id ?? crypto.randomUUID(),
      name: name.trim(),
      category,
      price: Number(price),
      duration: Number(duration),
      description: description.trim(),
      active: service?.active ?? true,
    };

    if (isEdit) {
      onUpdate(data);
    } else {
      onCreate(data);
    }

    resetForm();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="h-screen w-full max-w-xl overflow-y-auto bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              {isEdit ? "Edit Service" : "Add Service"}
            </h2>

            <p className="mt-2 text-slate-500">
              {isEdit
                ? "Update your service."
                : "Create a new service."}
            </p>
          </div>

          <button
            onClick={handleClose}
            className="rounded-xl p-2 text-2xl text-slate-500 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-2 block font-semibold">
              Category
            </label>

            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ServiceCategory)
              }
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            >
              {SERVICE_CATEGORIES.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block font-semibold">
              Service Name
            </label>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="mb-2 block font-semibold">
                Price
              </label>

              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold">
                Duration
              </label>

              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block font-semibold">
              Description
            </label>

            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
          </div>
        </div>

        <div className="mt-10 flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded-xl border border-slate-300 px-5 py-3 font-semibold"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            className="rounded-xl bg-black px-5 py-3 font-semibold text-white hover:bg-slate-800"
          >
            {isEdit ? "Update Service" : "Save Service"}
          </button>
        </div>
      </div>
    </div>
  );
}