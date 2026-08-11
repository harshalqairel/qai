import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookUser, BriefcaseBusiness, CheckCircle2, Circle, HandCoins, UserPlus, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

type GettingStartedGuideProps = {
  servicesComplete: boolean;
  customersComplete: boolean;
  bookingsComplete: boolean;
  paymentsComplete: boolean;
};

type GuideStep = {
  title: string;
  description: string;
  complete: boolean;
  icon: LucideIcon;
  actions: Array<{ href: string; label: string }>;
  status?: "next" | "upcoming";
};

function StepCard({ title, description, complete, icon: Icon, actions, status }: GuideStep) {
  const statusLabel = complete ? "Completed" : status === "next" ? "Next step" : "Upcoming";
  return (
    <article className={`rounded-xl border p-4 sm:p-5 ${complete ? "border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)]" : status === "next" ? "border-[var(--brand)] bg-white shadow-sm" : "border-[var(--dashboard-border)] bg-white"}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text)]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--dashboard-text)]">{title}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${complete ? "bg-[var(--dashboard-income-soft)] text-[var(--dashboard-income-text)]" : "bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-muted-text)]"}`}>
              {complete ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">{description}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {actions.map((action) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className={`${buttonVariants({ variant: complete ? "outline" : "default" })} w-full justify-center sm:w-auto`}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function GettingStartedGuide({
  servicesComplete,
  customersComplete,
  bookingsComplete,
  paymentsComplete,
}: GettingStartedGuideProps) {
  const steps: GuideStep[] = [
    {
      title: "Add your first service",
      description: "Tell Qai what customers can book.",
      complete: servicesComplete,
      icon: BriefcaseBusiness,
      actions: [{ href: "/services", label: "Add service" }],
    },
    {
      title: "Add your first customer",
      description: "Save their contact details for bookings and reminders.",
      complete: customersComplete,
      icon: UserPlus,
      actions: [{ href: "/customers", label: "Add customer" }],
    },
    {
      title: "Create your first booking",
      description: "Add the work date, service, and payment due date.",
      complete: bookingsComplete,
      icon: BookUser,
      actions: [{ href: "/bookings?new=1", label: "Create booking" }],
    },
    {
      title: "Record your first payment",
      description: "Keep Income and unpaid amounts accurate.",
      complete: paymentsComplete,
      icon: HandCoins,
      actions: [{ href: "/bookings?payment=outstanding", label: "Record payment" }],
    },
  ];
  const completedCount = steps.filter((step) => step.complete).length;
  const nextStepIndex = steps.findIndex((step) => !step.complete);
  const progress = Math.round((completedCount / steps.length) * 100);
  const stepsWithStatus = steps.map((step, index) => ({
    ...step,
    status: step.complete ? undefined : index === nextStepIndex ? "next" as const : "upcoming" as const,
  }));

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--dashboard-income-soft)] text-[var(--dashboard-income-text)]">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[var(--dashboard-text)]">Set up Qai</h2>
            <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">
              {completedCount === steps.length
                ? "Setup complete. Qai is ready for your daily workflow."
                : `${completedCount} of ${steps.length} setup steps completed.`}
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--dashboard-surface-muted)]" role="progressbar" aria-label="Business setup progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {stepsWithStatus.map((step) => (
          <StepCard key={step.title} {...step} />
        ))}
      </div>

      <p className="mt-4 text-sm text-[var(--dashboard-muted-text)]">
        The Dashboard will fill in as you add real bookings, payments, and expenses.
      </p>
    </section>
  );
}
