import { Payment } from "../types";
import { localStorageRepository } from "./localStorageRepository";

export interface PaymentRepository {
  getAll(): Payment[];
  save(payments: Payment[]): void;
  create(payment: Payment): void;
  update(payment: Payment): void;
  delete(id: string): void;
}

export const paymentRepository: PaymentRepository = {
  getAll() {
    return localStorageRepository.getAll();
  },

  save(payments: Payment[]) {
    localStorageRepository.save(payments);
  },

  create(payment: Payment) {
    const existing = localStorageRepository.getAll();
    localStorageRepository.save([...existing, payment]);
  },

  update(payment: Payment) {
    const existing = localStorageRepository.getAll();
    localStorageRepository.save(existing.map((p) => (p.id === payment.id ? payment : p)));
  },

  delete(id: string) {
    const existing = localStorageRepository.getAll();
    localStorageRepository.save(existing.filter((p) => p.id !== id));
  },
};
