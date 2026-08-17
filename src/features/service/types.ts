export type ServiceLocationPolicy = "Business/studio only" | "Client location only" | "Client can choose" | "Online";

export type ServiceOptionValue = {
  id: string;
  label: string;
  active: boolean;
  position: number;
};

export type ServiceOptionGroup = {
  id: string;
  name: string;
  position: number;
  values: ServiceOptionValue[];
};

export type ServiceVariant = {
  id: string;
  optionValueIds: string[];
  displayLabel: string;
  price: number;
  duration: number;
  defaultSessionCount: number;
  active: boolean;
};

export type ServiceOptionSnapshot = {
  groupId: string;
  groupName: string;
  valueId: string;
  valueLabel: string;
};

export type ServiceSelectionSnapshot = {
  serviceName: string;
  variantId: string | null;
  variantLabel: string;
  options: ServiceOptionSnapshot[];
  price: number;
  duration: number;
  defaultSessionCount: number;
};

export type Service = {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  duration: number;
  defaultSessionCount: number;
  locationPolicy?: ServiceLocationPolicy;
  optionGroups?: ServiceOptionGroup[];
  variants?: ServiceVariant[];
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
  optionGroups?: ServiceOptionGroup[];
  variants?: ServiceVariant[];
  description: string;
};
