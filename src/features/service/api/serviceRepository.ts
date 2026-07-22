import { Service } from "../types";
import { localStorageRepository } from "./localStorageRepository";

export interface ServiceRepository {
  getAll(): Service[];
  save(services: Service[]): void;
}

export const serviceRepository: ServiceRepository = localStorageRepository as ServiceRepository;
