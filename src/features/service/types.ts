export type ServiceLocationPolicy = "Business/studio only" | "Client location only" | "Client can choose" | "Online";

export type Service = {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  duration: number;
  defaultSessionCount: number;
  locationPolicy?: ServiceLocationPolicy;
  description: string;
  active: boolean;
};

export type CreateServiceInput = {
  name: string;
  categoryId: string;
  price: number;
  duration: number;
  defaultSessionCount: number;
  locationPolicy?: ServiceLocationPolicy;
  description: string;
};
