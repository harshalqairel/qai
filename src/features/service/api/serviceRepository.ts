import { Service } from "../types";
import { localStorageRepository } from "./localStorageRepository";

export interface ServiceRepository {
  getAll(): Service[];
  save(services: Service[]): void;
  create(service: Service): void;
  update(service: Service): void;
  delete(id: string): void;
}

export const serviceRepository: ServiceRepository = {
  getAll() { return localStorageRepository.getAll(); },
  save(services: Service[]) { return localStorageRepository.save(services); },
  create(service: Service) { const existing = localStorageRepository.getAll(); localStorageRepository.save([...existing, service]); },
  update(service: Service) { const existing = localStorageRepository.getAll(); localStorageRepository.save(existing.map((s) => (s.id === service.id ? service : s))); },
  delete(id: string) { const existing = localStorageRepository.getAll(); localStorageRepository.save(existing.filter((s) => s.id !== id)); },
};
