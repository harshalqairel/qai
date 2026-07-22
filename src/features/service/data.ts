import { Service, ServiceCategory } from "./types";

export const initialServices: Service[] = [
  {
    id: crypto.randomUUID(),
    name: "Wedding Package",
    category: ServiceCategory.WEDDING,
    price: 7500000,
    duration: 480,
    description: "Complete wedding makeup package.",
    active: true,
  },
  {
    id: crypto.randomUUID(),
    name: "Studio Rental",
    category: ServiceCategory.STUDIO,
    price: 350000,
    duration: 60,
    description: "Studio rental per hour.",
    active: true,
  },
  {
    id: crypto.randomUUID(),
    name: "Self Makeup Class",
    category: ServiceCategory.SELF,
    price: 1250000,
    duration: 120,
    description: "Private self makeup class.",
    active: true,
  },
];