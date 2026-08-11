# Qai

Qai is a simple business manager for freelancers and small creative businesses.

## Local development

```bash
npm install
npm run dev
```

The application runs in local mode by default and keeps the existing versioned
`localStorage` repositories available for development and safe migration.

## Cloud foundation

Qai's cloud mode uses Supabase Auth, PostgreSQL, Storage, and Row Level Security.
The initial schema is in
`supabase/migrations/202608100001_commercial_foundation.sql`.

1. Create a Supabase project.
2. Link the repository with the Supabase CLI and apply the migration.
3. Enable Google as an Auth provider and add these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://<production-domain>/auth/callback`
4. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and
   publishable key.
5. Keep `NEXT_PUBLIC_QAI_CLOUD_ENABLED=false` until the migration succeeds.
6. Set `NEXT_PUBLIC_QAI_CLOUD_ENABLED=true`, restart Next.js, sign in, create a
   business workspace, and import any existing local data from Settings.

The foundation models a booking and its schedule separately: one `bookings` row
owns one or more `booking_sessions` rows. Apply the migration before enabling
cloud mode so legacy single-date bookings can be imported as an idempotent
sequence-1 session. The import RPC, booking write RPC, ownership foreign keys,
deferred minimum-session constraint, and RLS policies are all defined in that
same migration.

Do not apply an older version of the commercial migration first. If a Supabase
project was created from an earlier draft, recreate the development project or
review a forward migration before enabling cloud mode.

## Financial reports and exports

The Reports area uses the same financial calculation module as the dashboard.
Excel exports are genuine `.xlsx` workbooks with numeric currency cells and
spreadsheet date values. Google Sheets export is an explicit, user-initiated
snapshot: configure `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, enable the Google Drive API,
and allow the `drive.file` scope. Each export creates a new spreadsheet and does
not overwrite a prior report. Calendar credentials are separate server-side
settings.

Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code. It is reserved for
verified server jobs and webhooks in later launch phases.

## Quality checks

```bash
npm run lint
npm test
npx tsc --noEmit
npm run build
```

Two existing React Hook Form `react-hooks/incompatible-library` warnings are
currently accepted. New warnings should not be introduced.
