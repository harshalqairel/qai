# Qai UX copy guidelines

## Voice and tone

Write for someone running a service business. Be clear, calm, concise, and factual. Sound useful and confident, never promotional or overly enthusiastic. Avoid exclamation marks unless they are genuinely necessary.

## Canonical terms

- **Client**: the person or business purchasing a service. Use “client” in the UI; internal code may retain `customer`.
- **Service**: what the business offers.
- **Booking**: the overall job or service engagement.
- **Schedule**: one date and time within a booking. Never expose “BookingSession” or “session entity.”
- **Income**: payments actually recorded. Do not use “revenue” or “money received” for this metric.
- **Expenses**: money recorded as spent.
- **Profit**: Qai’s existing calculated profit; do not reinterpret it in copy.
- **Unpaid amount**: money still unpaid from active bookings.
- **Payment reminder**: a user-initiated follow-up. Use “Payments due soon” and “Overdue payments.”

## Interface conventions

- Use sentence case for labels: “Service category,” “Payment method,” “Reminder history.”
- Buttons describe the result: “Add booking,” “Record payment,” “Save changes,” “Delete expense.”
- Success messages state what happened: “Booking added.” “Changes saved.”
- Errors explain what to fix and never expose technical details: “Enter an amount greater than Rp 0.”
- Validate after interaction, on blur, or on submit—not aggressively on first open.

## Empty states

State what is missing, then give one clear next action. Example: “No services yet. Add the services you offer.” Pair it with “Add service” when the action is available. Keep empty states neutral.

## Avoid

Do not use hype (“Awesome,” “Unlock your potential”), generic SaaS language (“optimize your workflow”), or developer terms such as tenant, repository, schema, enum, migration, localStorage, Supabase, RLS, `null`, or `undefined` in normal UI.

## Brand hierarchy

- Application lockup: Qai mark + **Qai** only. No permanent tagline or subtitle.
- Landing headline: **Your business, organized.**
- Landing support: **Manage bookings, clients, income, expenses, and reminders in one place.**
- The monogram must remain a simple, monochrome Q. Do not add gradients, sparkles, arrows, or feature icons to the mark.

Good: “Add client,” “3 schedules,” “Rp 500.000 remaining,” “Did you send the reminder?”

Avoid: “Add customer,” “3 sessions,” “Revenue intelligence,” “Sent successfully.”
