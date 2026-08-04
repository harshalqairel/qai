"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import CategoryManager from "@/features/category/components/CategoryManager";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";
import DataBackupSection from "@/features/backup/components/DataBackupSection";
import HowToUseQai from "@/features/settings/components/HowToUseQai";
import {
  Bell,
  CircleHelp,
  CalendarDays,
  CircleUserRound,
  CreditCard,
  Database,
  Info,
  Link2,
  ReceiptText,
  Tags,
  WalletCards,
} from "lucide-react";
import PageSkeleton from "@/components/system/PageSkeleton";
import { QaiLogo } from "@/components/brand/QaiLogo";

const SECTIONS = [
  { id: "business-profile", label: "Business Profile", Icon: CircleUserRound },
  { id: "how-to-use", label: "How to use Qai", Icon: CircleHelp },
  { id: "data-backup", label: "Data Backup", Icon: Database },
  { id: "service-categories", label: "Service Categories", Icon: Tags },
  { id: "expense-categories", label: "Expense Categories", Icon: ReceiptText },
  { id: "payment-terms", label: "Payment Terms", Icon: WalletCards },
  { id: "notifications", label: "Notifications", Icon: Bell },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "connected-apps", label: "Connected Apps", Icon: Link2 },
  { id: "billing", label: "Billing", Icon: CreditCard },
  { id: "about", label: "About Qai", Icon: Info },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </section>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<SectionId>(() => {
    if (typeof window === "undefined") return "business-profile";
    const requested = new URLSearchParams(window.location.search).get("section");
    if (requested && SECTIONS.some((item) => item.id === requested)) {
      return requested as SectionId;
    }
    return "business-profile";
  });
  const serviceCategories = useServiceCategories();
  const expenseCategories = useExpenseCategories();

  if (serviceCategories.isLoading || expenseCategories.isLoading) {
    return <main className="min-h-screen"><PageSkeleton variant="settings" /></main>;
  }

  return (
    <main className="min-h-screen">
      <div className="page-shell">
        <header>
          <h1 className="page-title">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Manage categories and see what can be set up later.
          </p>
        </header>

        <div className="lg:hidden">
          <label htmlFor="settings-section" className="mb-2 block text-sm font-semibold">
            Settings section
          </label>
          <select
            id="settings-section"
            value={section}
            onChange={(event) => setSection(event.target.value as SectionId)}
            className="native-control"
          >
            {SECTIONS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav className="surface-card hidden self-start p-2 lg:block" aria-label="Settings sections">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={section === id ? "page" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${section === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {section === "business-profile" && (
              <Placeholder title="Business Profile" message="Not set up yet" />
            )}
            {section === "how-to-use" && <HowToUseQai />}
            {section === "data-backup" && <DataBackupSection />}
            {section === "service-categories" && (
              <CategoryManager
                title="Service Categories"
                description="Organize the services your business offers."
                recordName="service"
                categories={serviceCategories.categories}
                usageCounts={serviceCategories.usageCounts}
                onCreate={serviceCategories.createCategory}
                onUpdate={serviceCategories.updateCategory}
                onSetActive={serviceCategories.setCategoryActive}
                onDelete={serviceCategories.deleteCategory}
                loadError={serviceCategories.loadError}
                onRetry={serviceCategories.retry}
              />
            )}
            {section === "expense-categories" && (
              <CategoryManager
                title="Expense Categories"
                description="Keep recorded costs easy to group and review."
                recordName="expense"
                categories={expenseCategories.categories}
                usageCounts={expenseCategories.usageCounts}
                onCreate={expenseCategories.createCategory}
                onUpdate={expenseCategories.updateCategory}
                onSetActive={expenseCategories.setCategoryActive}
                onDelete={expenseCategories.deleteCategory}
                loadError={expenseCategories.loadError}
                onRetry={expenseCategories.retry}
              />
            )}
            {section === "payment-terms" && (
              <Placeholder title="Payment Terms" message="Not set up yet" />
            )}
            {section === "notifications" && (
              <Placeholder title="Notifications" message="Coming soon" />
            )}
            {section === "calendar" && (
              <section className="surface-card p-5 sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                        <CalendarDays className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h2 className="text-lg font-bold tracking-tight">Google Calendar</h2>
                        <span className="mt-1 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                          Not connected
                        </span>
                      </div>
                    </div>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
                      Connect your calendar to automatically add your Qai bookings.
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <Button disabled>Connect Google Calendar</Button>
                    <p className="mt-2 text-xs text-muted-foreground">Available after cloud setup</p>
                  </div>
                </div>
              </section>
            )}
            {section === "connected-apps" && (
              <Placeholder title="Connected Apps" message="No app connected" />
            )}
            {section === "billing" && (
              <Placeholder title="Billing" message="Coming soon" />
            )}
            {section === "about" && (
              <section className="surface-card p-5 sm:p-6">
                <QaiLogo size="md" />
                <h2 className="mt-5 text-lg font-bold tracking-tight">About Qai</h2>
                <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-[140px_1fr]">
                  <div className="contents">
                    <dt className="font-semibold text-foreground">Product</dt>
                    <dd className="text-muted-foreground">Qai</dd>
                  </div>
                  <div className="contents">
                    <dt className="font-semibold text-foreground">Description</dt>
                    <dd className="text-muted-foreground">
                      A simple business tool for bookings, customers, payments, and expenses.
                    </dd>
                  </div>
                </dl>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
