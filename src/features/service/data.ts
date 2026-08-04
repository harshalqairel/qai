import { createDeterministicCategory } from "@/features/category/utils";
import { Service } from "./types";

export const initialServices: Service[] = [
  {
    id: crypto.randomUUID(),
    name: "Wedding Package",
    categoryId: createDeterministicCategory("service", "Wedding").id,
    price: 7500000,
    duration: 480,
    description: "Complete wedding makeup package.",
    active: true,
  },
  {
    id: crypto.randomUUID(),
    name: "Studio Rental",
    categoryId: createDeterministicCategory("service", "Studio Rental").id,
    price: 350000,
    duration: 60,
    description: "Studio rental per hour.",
    active: true,
  },
  {
    id: crypto.randomUUID(),
    name: "Self Makeup Class",
    categoryId: createDeterministicCategory("service", "Self Makeup Class").id,
    price: 1250000,
    duration: 120,
    description: "Private self makeup class.",
    active: true,
  },
];
