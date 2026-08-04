import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookUser, BriefcaseBusiness, CheckCircle2, Circle, ReceiptText, Tags, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

type GettingStartedGuideProps = {
  serviceCategoriesComplete: boolean;
  expenseCategoriesComplete: boolean;
  servicesComplete: boolean;
  customerAndBookingComplete: boolean;
};

type GuideStep = {
  title: string;
  description: string;
  complete: boolean;
  icon: LucideIcon;
  actions: Array<{ href: string; label: string }>;
};

function StepCard({ title, description, complete, icon: Icon, actions }: GuideStep) {
  return (
    <article className={`rounded-xl border p-4 sm:p-5 ${complete ? "border-[var(--dashboard-border)] bg-[var(--dashboard-surface-muted)]" : "border-[var(--dashboard-border)] bg-white"}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-text)]">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--dashboard-text)]">{title}</h2>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${complete ? "bg-[var(--dashboard-income-soft)] text-[var(--dashboard-income-text)]" : "bg-[var(--dashboard-surface-muted)] text-[var(--dashboard-muted-text)]"}`}>
              {complete ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <Circle className="size-3.5" aria-hidden="true" />}
              {complete ? "Completed" : "Not started"}
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
  serviceCategoriesComplete,
  expenseCategoriesComplete,
  servicesComplete,
  customerAndBookingComplete,
}: GettingStartedGuideProps) {
  const steps: GuideStep[] = [
    {
      title: "Add service categories",
      description: "Organize the services you offer.",
      complete: serviceCategoriesComplete,
      icon: Tags,
      actions: [{ href: "/settings?section=service-categories", label: "Set up service categories" }],
    },
    {
      title: "Add expense categories",
      description: "Organize your business expenses.",
      complete: expenseCategoriesComplete,
      icon: ReceiptText,
      actions: [{ href: "/settings?section=expense-categories", label: "Set up expense categories" }],
    },
    {
      title: "Add your services",
      description: "Add the services customers can book.",
      complete: servicesComplete,
      icon: BriefcaseBusiness,
      actions: [{ href: "/services", label: "Add service" }],
    },
    {
      title: "Add your first customer and booking",
      description: "Start managing your schedule and payments.",
      complete: customerAndBookingComplete,
      icon: BookUser,
      actions: [
        { href: "/customers", label: "Add customer" },
        { href: "/bookings", label: "Add booking" },
      ],
    },
  ];

  return (
    <section className="surface-card p-5 sm:p-6">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--dashboard-income-soft)] text-[var(--dashboard-income-text)]">
            <UsersRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[var(--dashboard-text)]">Welcome to Qai</h2>
            <p className="mt-1 text-sm text-[var(--dashboard-muted-text)]">
              Set up your business in a few simple steps.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {steps.map((step) => (
          <StepCard key={step.title} {...step} />
        ))}
      </div>

      <p className="mt-4 text-sm text-[var(--dashboard-muted-text)]">
        The Dashboard will fill in as you add real bookings, payments, and expenses.
      </p>
    </section>
  );
}
