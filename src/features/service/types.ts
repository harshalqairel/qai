export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  duration: number;
  description: string;
  active: boolean;
};

export enum ServiceCategory {
  WEDDING = "Wedding",
  STUDIO = "Studio Rental",
  SELF = "Self Makeup Class",
  COURSE = "Professional Class",
  FNB = "Food & Beverage",
}