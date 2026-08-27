# Qai invoice and Qai Space validation guide

This build is for product validation with freelancers and test customers. It is not a production deployment and should use dummy or low-sensitivity test data.

## Start Qai

1. Install dependencies with `npm install`.
2. Start the local application with `npm run dev`.
3. Open `http://localhost:3000`.

The owner application continues to store its normal localhost records in the owner's browser. Public Qai Space configuration and customer requests use the shared validation store described below.

## Configure invoices

Open **Invoices**, then choose **Invoice settings**. Add the business display name, optional legal name, contact details, invoice prefix, payment instructions, notes, payment terms, logo, and schedule preference.

The logo must be PNG, JPG, or WebP and no larger than 2 MB. The validation build includes the subtle **Created with Qai** PDF footer. The setting is structurally separate so a future entitlement can control it; this build does not include subscription logic.

Open **Settings → Invoice sharing** to customize:

- WhatsApp message
- Email subject
- Email message

Choose a field, use **Insert variable**, and review the live example. **Reset to default** changes only the selected field. Save explicitly. A one-time edit made from an invoice's Share dialog does not change these saved defaults.

## Create an invoice from a booking

Open **Invoices → New invoice → From a booking**, or open a Booking's financial details and choose **Create invoice**.

The draft uses the existing Client, Service, booking price, schedules, due date, contact details, and actual recorded Payments. Creating or issuing an invoice does not create a Payment or Income record and does not change the Booking.

Review the draft and choose **Issue invoice**. Issuing assigns a stable number such as `INV-2026-0001` and snapshots the business, client, item, schedule, date, note, and total values. Actual booking Payments remain the dynamic source for Paid and Remaining.

## Create a custom invoice

Open **Invoices → New invoice → Custom invoice**. Select an existing Client or enter the client manually, then add line items, quantities, unit prices, optional discount, optional tax, notes, and payment instructions.

A custom invoice does not create a Booking, Payment, or Income entry. Payment tracking for standalone invoices is intentionally limited to **Unpaid** in this validation build; record real receipts only through the established Booking Payment flow.

## Download and share

Issued invoices support:

- **Download PDF** for a genuine local PDF with selectable text, page breaks, schedules, totals, logo support, and restrained Qai attribution.
- **WhatsApp** to review and optionally edit a one-time message, then open `wa.me`.
- **Email** to review and optionally edit the subject and message, then open `mailto:`.

The browser cannot attach the PDF automatically. Download it first if it should be attached. Opening WhatsApp or an email app does not confirm delivery.

## Configure Qai Space

Open **Space** in the owner navigation.

### Page

Add the business name, description, location, contact details, optional logo, optional cover image, and a safe Space address. Save the profile.

### Services

For each existing Qai Service, choose whether it is public and configure:

- public title and description
- Fixed price, Starting from, or Ask for price
- Booking request, Inquiry, or Instant booking

Instant booking is deliberately simple. Manually add only times that are ready to confirm. Saving the page publishes the current service settings and slots.

### Preview and link

Use **Preview** to open the customer-facing Space. **Copy Space link** derives the URL from the current browser origin. It therefore works with localhost and with a temporary HTTPS tunnel without hardcoded hostnames.

## Requests

Customer submissions appear under **Qai Space → Requests**. The inbox refreshes automatically and also has a manual Refresh action.

- **Accept** creates one Booking through Qai's existing idempotent booking domain.
- **Edit & accept** opens the normal Booking form with the Client, Service, schedules, location, and notes prefilled.
- **Create booking** does the same for an Inquiry; inquiries never create a Booking automatically.
- **Decline** preserves the request and creates no Booking.
- Confirmed Instant bookings reserve the shared slot atomically. Use **Create owner booking** to import the confirmed job into the owner's browser. Repeating the action reuses the same booking creation request and cannot create a duplicate.

A request with three preferred schedules becomes one Booking with three schedules. The Calendar then displays all three.

## Customize the Dashboard

Open **Dashboard → Customize dashboard**. Show or hide supported sections and use Move up or Move down. At least one section remains visible. **Restore default** restores Qai's original order and visibility without affecting records or calculations.

Dashboard preferences stay in the owner browser for refresh and navigation testing. **New requests** reads pending customer submissions from the shared validation store.

## Shared validation data

Cross-device Qai Space data lives in:

`.qai-validation/store.json`

The directory is ignored by Git. It contains public page configuration, published service settings, slots, requests, request status, and request-to-booking references. Writes are serialized and replace the file atomically. It is intentionally isolated from normal Qai repositories so it can later be replaced by Supabase.

Do not commit or share the store. Use dummy names, phone numbers, emails, and notes.

To reset only the shared validation data from the Qai workspace:

`npm run validation:reset`

This developer-only command removes the exact `.qai-validation` directory. There is no public reset endpoint or public reset control.

Normal owner browser data and invoice drafts are not removed by this command. Clear them separately through Qai's existing local data controls or a dedicated test browser profile.

## Temporary HTTPS tunnel

If `cloudflared` is already installed, a generic Quick Tunnel can be started with:

`cloudflared tunnel --url http://localhost:3000`

Do not install it automatically and do not hardcode the generated address. Quick Tunnel URLs are temporary and change when the tunnel restarts. Open the owner application through the temporary URL before using **Copy link**, so the copied Space link uses that origin.

Keep the local server running while testers use the page. A tunnel exposes the local validation application to the internet; use test data, stop the tunnel after the session, and do not treat this as production security.

## Validation-only limitations

- No production authentication, tenant isolation, RLS, rate limiting, abuse prevention, or legal/privacy framework.
- No hosted database, uptime guarantee, backups, production concurrency guarantee, or recovery tooling.
- Invoice records and Dashboard preferences remain in the owner's browser.
- Shared public data exists only while the local validation store is retained.
- Standalone invoices do not maintain a separate payment ledger.
- WhatsApp and email actions open user-controlled apps; Qai does not send or confirm delivery.
- PDFs are generated locally and are not uploaded or attached automatically.
- Instant booking uses manually published slots, not a complete availability engine.
- Instant bookings enter the owner's local Booking records when the owner opens Requests and chooses **Create owner booking**.

## Future Supabase requirements

After validation, production design will need:

### Invoice

- business-scoped persistence and tenant isolation
- atomic invoice numbering
- immutable issued snapshots
- sharing-template persistence
- logo/file storage
- invoice-branding entitlement
- optional standalone payment integration without creating a second ledger

### Qai Space

- authenticated business ownership
- globally unique slugs
- public Service configuration
- Requests and Request-to-Booking relations
- transactional Instant slot reservation and Booking creation
- public/selective RLS policies
- rate limits, abuse prevention, spam controls, and audit history

### Dashboard

- user-scoped order and visibility preferences

### General

- Auth, business membership, tenant isolation, production storage, backups, privacy controls, legal review, monitoring, and secure deployment

This validation sprint deliberately stops before Supabase, production hosting, payment gateways, automatic messaging, subscriptions, or launch infrastructure.
