"use client";

import { useEffect, useState } from "react";
import CategoryManager from "@/features/category/components/CategoryManager";
import { useServiceCategories } from "@/features/service-category/hooks/useServiceCategories";
import { useExpenseCategories } from "@/features/expense-category/hooks/useExpenseCategories";
import DataBackupSection from "@/features/backup/components/DataBackupSection";
import LocalDataImportSection from "@/features/import/components/LocalDataImportSection";
import SpreadsheetImportSection from "@/features/import/components/SpreadsheetImportSection";
import { isCloudModeEnabled } from "@/lib/supabase/config";
import HowToUseQai from "@/features/settings/components/HowToUseQai";
import PaymentReminderSettings from "@/features/reminder/components/PaymentReminderSettings";
import AppearanceSettings from "@/features/appearance/AppearanceSettings";
import InvoiceSharingSettings from "@/features/invoice/InvoiceSharingSettings";
import NotificationSettings from "@/features/notifications/NotificationSettings";
import BookingQuestionnaireSettings from "@/features/booking-questionnaire/BookingQuestionnaireSettings";
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
  CalendarDays,
  FileCheck2,
  Waypoints,
  Bell,
  ListChecks,
} from "lucide-react";
import PageSkeleton from "@/components/system/PageSkeleton";
import { QaiLogo } from "@/components/brand/QaiLogo";

const SECTIONS = [
  { id: "how-to-use", label: "How to use Qai", description: "Tips for getting the most from Qai", Icon: CircleHelp },
  { id: "data-backup", label: "Data backup", description: "Download or restore your business data", Icon: Database },
  { id: "service-categories", label: "Service categories", description: "Organize the services you offer", Icon: Tags },
  { id: "expense-categories", label: "Expense categories", description: "Manage how expenses are grouped", Icon: ReceiptText },
  { id: "booking-questions", label: "Booking questions", description: "Customize client questions and booking text", Icon: ListChecks },
  { id: "payment-reminders", label: "Payment reminders", description: "Customize WhatsApp and email wording", Icon: MessagesSquare },
  { id: "invoice-sharing", label: "Invoice sharing", description: "Customize invoice WhatsApp and email wording", Icon: MessagesSquare },
  { id: "notifications", label: "Notifications", description: "Choose optional browser alerts", Icon: Bell },
  { id: "appearance", label: "Appearance", description: "Choose your Qai visual mood", Icon: Palette },
  { id: "about", label: "About Qai", description: "Product information", Icon: Info },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const MOBILE_GROUPS: Array<{ label: string; sections: SectionId[] }> = [
  { label: "Management", sections: ["booking-questions", "service-categories", "expense-categories"] },
  { label: "Communication", sections: ["payment-reminders", "invoice-sharing", "notifications"] },
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
              <div className="space-y-5">{isCloudModeEnabled() ? <LocalDataImportSection /> : <DataBackupSection />}<SpreadsheetImportSection /></div>
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
            {activeSection === "notifications" && <NotificationSettings />}
            {activeSection === "appearance" && <AppearanceSettings />}
            {activeSection === "about" && (
              <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="bg-[linear-gradient(135deg,var(--accent),var(--card)_65%)] p-6 sm:p-9"><QaiLogo size="lg" /><p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-[var(--brand)]">Your connected business workspace</p><h2 className="mt-2 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">Keep the work connected from first request to financial report.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">Qai helps independent creative businesses reuse the same client, service, booking, and schedule details across the workflow—without pretending to replace the channels where customers already find and contact you.</p></div>
                <div className="grid gap-px bg-border sm:grid-cols-3"><AboutValue icon={Waypoints} title="One underlying job" text="Request, booking, schedules, invoice, payment, reminder, and reporting stay related." /><AboutValue icon={CalendarDays} title="Works with your tools" text="Use Instagram and WhatsApp for conversations, and optionally send Qai schedules to Google Calendar." /><AboutValue icon={FileCheck2} title="Your business records" text="Export your financial report and keep access to the records you create in Qai." /></div>
                <div className="p-6 sm:p-8"><h3 className="font-semibold">About this validation build</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">This temporary environment is for real-user product feedback. It is not the final commercial authentication or billing system. Please use copied or non-sensitive test data.</p><p className="mt-5 text-xs text-muted-foreground">Qai · Validation build · Built for independent creative businesses</p></div>
              </section>
            )}
            {activeSection === "booking-questions" && <BookingQuestionnaireSettings />}
          </div>
        </div>
      </div>
    </main>
  );
}

function AboutValue({ icon: Icon, title, text }: { icon: typeof Info; title: string; text: string }) { return <article className="bg-card p-6"><span className="flex size-10 items-center justify-center rounded-xl bg-accent text-[var(--brand)]"><Icon className="size-5" /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>; }
