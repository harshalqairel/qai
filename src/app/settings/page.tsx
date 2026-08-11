"use client";

import { useEffect, useState } from "react";
import CategoryManager from "@/features/category/components/CategoryManager";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";
import DataBackupSection from "@/features/backup/components/DataBackupSection";
import LocalDataImportSection from "@/features/import/components/LocalDataImportSection";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import HowToUseQai from "@/features/settings/components/HowToUseQai";
import PaymentReminderSettings from "@/features/reminder/components/PaymentReminderSettings";
import AppearanceSettings from "@/features/appearance/AppearanceSettings";
import InvoiceSharingSettings from "@/features/invoice/InvoiceSharingSettings";
import {
  ArrowLeft,
  CircleHelp,
  Database,
  Info,
  ReceiptText,
  Tags,
  ChevronRight,
  MessagesSquare,
  Palette,
} from "lucide-react";
import PageSkeleton from "@/components/system/PageSkeleton";
import { QaiLogo } from "@/components/brand/QaiLogo";

const SECTIONS = [
  { id: "how-to-use", label: "How to use Qai", description: "Tips for getting the most from Qai", Icon: CircleHelp },
  { id: "data-backup", label: "Data backup", description: "Download or restore your business data", Icon: Database },
  { id: "service-categories", label: "Service categories", description: "Organize the services you offer", Icon: Tags },
  { id: "expense-categories", label: "Expense categories", description: "Manage how expenses are grouped", Icon: ReceiptText },
  { id: "payment-reminders", label: "Payment reminders", description: "Customize WhatsApp and email wording", Icon: MessagesSquare },
  { id: "invoice-sharing", label: "Invoice sharing", description: "Customize invoice WhatsApp and email wording", Icon: MessagesSquare },
  { id: "appearance", label: "Appearance", description: "Choose your Qai visual mood", Icon: Palette },
  { id: "about", label: "About Qai", description: "Product information", Icon: Info },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const MOBILE_GROUPS: Array<{ label: string; sections: SectionId[] }> = [
  { label: "Management", sections: ["service-categories", "expense-categories"] },
  { label: "Communication", sections: ["payment-reminders", "invoice-sharing"] },
  { label: "Preferences", sections: ["appearance"] },
  { label: "Data", sections: ["data-backup"] },
  { label: "Product", sections: ["about"] },
  { label: "Help", sections: ["how-to-use"] },
];

function requestedSection(): SectionId | null {
  if (typeof window === "undefined") return null;
  const requested = new URLSearchParams(window.location.search).get("section");
  return SECTIONS.some((item) => item.id === requested) ? requested as SectionId : null;
}

export default function SettingsPage() {
  const [section, setSection] = useState<SectionId | null>(requestedSection);
  const serviceCategories = useServiceCategories();
  const expenseCategories = useExpenseCategories();
  const activeSection = section ?? "how-to-use";
  const activeDefinition = SECTIONS.find((item) => item.id === activeSection)!;

  useEffect(() => {
    const handlePopState = () => setSection(requestedSection());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function openSection(nextSection: SectionId) {
    setSection(nextSection);
    const url = new URL(window.location.href);
    url.searchParams.set("section", nextSection);
    window.history.pushState({ settingsSection: nextSection }, "", url);
  }

  function openSettingsHome() {
    setSection(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("section");
    window.history.pushState({ settingsSection: null }, "", url);
  }

  if (serviceCategories.isLoading || expenseCategories.isLoading) {
    return <main className="min-h-screen"><PageSkeleton variant="settings" /></main>;
  }

  return (
    <main className="min-h-screen">
      <div className="page-shell">
        <header className={section ? "hidden lg:block" : undefined}>
          <h1 className="page-title">Settings</h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Manage Qai preferences, categories, reminders, and data.
          </p>
        </header>

        {!section && (
          <nav className="space-y-6 lg:hidden" aria-label="Settings">
            {MOBILE_GROUPS.map((group) => (
              <section key={group.label} aria-labelledby={`settings-group-${group.label.toLowerCase()}`}>
                <h2
                  id={`settings-group-${group.label.toLowerCase()}`}
                  className="mb-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {group.label}
                </h2>
                <div className="surface-card divide-y divide-border overflow-hidden p-0">
                  {group.sections.map((id) => {
                    const item = SECTIONS.find((candidate) => candidate.id === id)!;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openSection(item.id)}
                        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:bg-muted"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                          <item.Icon className="size-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-foreground">{item.label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                        </span>
                        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>
        )}

        {section && (
          <header className="lg:hidden">
            <button
              type="button"
              onClick={openSettingsHome}
              className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-accent"
              aria-label="Back to Settings"
            >
              <ArrowLeft className="size-5" aria-hidden="true" /> Settings
            </button>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{activeDefinition.label}</h1>
          </header>
        )}

        <div className={`${section ? "grid" : "hidden lg:grid"} min-w-0 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]`}>
          <nav className="surface-card hidden self-start p-2 lg:block" aria-label="Settings sections">
            {SECTIONS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => openSection(id)}
                aria-current={activeSection === id ? "page" : undefined}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${activeSection === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0">
            {activeSection === "how-to-use" && <HowToUseQai />}
            {activeSection === "data-backup" && (
              isCloudModeEnabled() ? <LocalDataImportSection /> : <DataBackupSection />
            )}
            {activeSection === "service-categories" && (
              <CategoryManager
                title="Service categories"
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
            {activeSection === "expense-categories" && (
              <CategoryManager
                title="Expense categories"
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
            {activeSection === "payment-reminders" && <PaymentReminderSettings />}
            {activeSection === "invoice-sharing" && <InvoiceSharingSettings />}
            {activeSection === "appearance" && <AppearanceSettings />}
            {activeSection === "about" && (
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
                      Manage bookings, clients, income, expenses, and reminders in one place.
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
