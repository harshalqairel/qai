"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { QaiLogo } from "@/components/brand/QaiLogo";
import { Button } from "@/components/ui/button";
import { bookingRepository } from "@/features/booking/api/bookingRepository";
import { customerRepository } from "@/features/customer/api/customerRepository";
import { expenseRepository } from "@/features/expense/api/expenseRepository";
import { expenseCategoryRepository } from "@/features/expense-category/api/expenseCategoryRepository";
import { paymentRepository } from "@/features/payment/api/paymentRepository";
import { serviceRepository } from "@/features/service/api/serviceRepository";
import { serviceCategoryRepository } from "@/features/service-category/api/serviceCategoryRepository";
import { PersistenceError } from "@/lib/persistence";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import { hydrateWorkspaceDocuments } from "@/lib/validation/workspaceSync";
import {
  cloudBookingRepository,
  cloudCustomerRepository,
  cloudExpenseCategoryRepository,
  cloudExpenseRepository,
  cloudPaymentRepository,
  cloudServiceCategoryRepository,
  cloudServiceRepository,
} from "@/lib/supabase/cloudRepositories";

type StartupFailure = "migration" | "load" | null;

export default function AppStartup({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<StartupFailure>(null);

  const prepare = useCallback(async () => {
    setFailure(null);
    try {
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
      } else {
        customerRepository.getAll();
        serviceCategoryRepository.getAll();
        serviceRepository.getAll();
        bookingRepository.getAll();
        paymentRepository.getAll();
        expenseCategoryRepository.getAll();
        expenseRepository.getAll();
      }
      setReady(true);
    } catch (error) {
      setFailure(error instanceof PersistenceError && error.code === "MIGRATION_FAILURE" ? "migration" : "load");
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void prepare(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [prepare]);

  if (ready) return children;

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6 lg:min-h-screen">
      <section className="startup-reveal w-full max-w-sm text-center" aria-live="polite">
        <QaiLogo size="lg" />
        {failure ? (
          <div className="mt-7" role="alert">
            <h1 className="text-xl font-semibold text-foreground">
              {failure === "migration" ? "Could not update your data." : "Could not load your data."}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {failure === "migration" ? "Your old data is still safe." : "Your saved data was not changed."}
            </p>
            <Button className="mt-5" onClick={() => { void prepare(); }}>Try again</Button>
          </div>
        ) : (
          <div className="mt-7 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>Getting things ready…</span>
          </div>
        )}
      </section>
    </main>
  );
}

