const SECTIONS = [
  {
    title: "Set up your business",
    description: "Create service and expense categories first. Then add the services you offer.",
  },
  {
    title: "Add customers",
    description: "Save customer details so you can use them when creating bookings.",
  },
  {
    title: "Create a booking",
    description: "Choose a customer, service, date, time, price, and payment due date.",
  },
  {
    title: "Record payments",
    description: "Open a booking and record each payment you receive. Qai will calculate the unpaid amount automatically.",
  },
  {
    title: "Add expenses",
    description: "Record business expenses and expenses related to a booking.",
  },
  {
    title: "Check the Dashboard",
    description: "Use the Dashboard to see money received, unpaid amounts, expenses, profit, and upcoming work.",
  },
  {
    title: "Back up your data",
    description: "Download a backup regularly. Use Restore backup when moving data back into Qai.",
  },
] as const;

export default function HowToUseQai() {
  return (
    <section className="surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-foreground">How to use Qai</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Follow these simple steps to get your business set up and running.
      </p>

      <div className="mt-5 space-y-4">
        {SECTIONS.map((section, index) => (
          <article key={section.title} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Step {index + 1}
            </p>
            <h3 className="mt-1 font-semibold text-foreground">{section.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
