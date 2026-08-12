import { bookingRepository } from "@/features/booking/api/bookingRepository";
import { customerRepository } from "@/features/customer/api/customerRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";
import { expenseCategoryRepository } from "@/features/expense-category/api/expenseCategoryRepository";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { serviceRepository } from "@/features/service/api/serviceRepository";
import { serviceCategoryRepository } from "@/features/service-category/api/serviceCategoryRepository";
import {
  cloudBookingRepository,
  cloudCustomerRepository,
  cloudExpenseCategoryRepository,
  cloudExpenseRepository,
  cloudPaymentRepository,
  cloudServiceCategoryRepository,
  cloudServiceRepository,
} from "@/lib/supabase/cloudRepositories";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { hydrateWorkspaceDocuments } from "@/lib/validation/workspaceSync";

export async function prepareApplicationData(): Promise<void> {
  await hydrateWorkspaceDocuments();

  if (isCloudModeEnabled()) {
    await Promise.all([
      cloudCustomerRepository.getAll(),
      cloudServiceCategoryRepository.getAll(),
      cloudServiceRepository.getAll(),
      cloudBookingRepository.getAll(),
      cloudPaymentRepository.getAll(),
      cloudExpenseCategoryRepository.getAll(),
      cloudExpenseRepository.getAll(),
    ]);
    return;
  }

  customerRepository.getAll();
  serviceCategoryRepository.getAll();
  serviceRepository.getAll();
  bookingRepository.getAll();
  paymentRepository.getAll();
  expenseCategoryRepository.getAll();
  expenseRepository.getAll();
}
