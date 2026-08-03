import { Customer } from "../types";
import { localStorageRepository } from "./localStorageRepository";

export interface CustomerRepository {
  getAll(): Customer[];
  save(customers: Customer[]): void;
  create(customer: Customer): void;
  update(customer: Customer): void;
  delete(id: string): void;
}

export const customerRepository: CustomerRepository = {
  getAll() { return localStorageRepository.getAll(); },
  save(customers: Customer[]) { return localStorageRepository.save(customers); },
  create(customer: Customer) { const existing = localStorageRepository.getAll(); localStorageRepository.save([...existing, customer]); },
  update(customer: Customer) { const existing = localStorageRepository.getAll(); localStorageRepository.save(existing.map((c) => (c.id === customer.id ? customer : c))); },
  delete(id: string) { const existing = localStorageRepository.getAll(); localStorageRepository.save(existing.filter((c) => c.id !== id)); },
};
