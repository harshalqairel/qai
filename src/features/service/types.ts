export type ServiceLocationPolicy = "Business/studio only" | "Client location only" | "Client can choose" | "Online";

export type ServiceBookingTimeMode = "Flexible" | "Recurring times" | "Dated sessions";
export type ServiceCapacityMode = "One booking" | "Multiple bookings";

export type ServiceRecurringTime = {
  id: string;
  weekday: number;
  startTime: string;
  capacity: number | null;
  manualBlocked: number;
};

export type ServiceDatedSession = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number | null;
  manualBlocked: number;
  active: boolean;
};

export type ServiceAvailabilityOverride = {
  id: string;
  date: string;
  startTime: string;
  capacity: number | null;
  manualBlocked: number;
  unavailable: boolean;
};

export type ServiceAvailability = {
  mode: ServiceBookingTimeMode;
  capacityMode: ServiceCapacityMode;
  defaultCapacity: number;
  recurringTimes: ServiceRecurringTime[];
  datedSessions: ServiceDatedSession[];
  overrides: ServiceAvailabilityOverride[];
};

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
  availability?: ServiceAvailability;
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
  availability?: ServiceAvailability;
  description: string;
};
