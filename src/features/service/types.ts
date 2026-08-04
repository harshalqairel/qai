export type Service = {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  duration: number;
  description: string;
  active: boolean;
};

export type CreateServiceInput = {
  name: string;
  categoryId: string;
  price: number;
  duration: number;
  description: string;
};
