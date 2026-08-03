export type Customer = {
  id: string;
  name: string;
  phone: string;
  instagram: string;
  email: string;
  notes: string;
  createdAt: number;
};

export type CreateCustomerInput = {
  name: string;
  phone: string;
  instagram: string;
  email: string;
  notes: string;
};

export type UpdateCustomerInput = CreateCustomerInput & {
  id: string;
};

export type CustomerFormValues = CreateCustomerInput;
