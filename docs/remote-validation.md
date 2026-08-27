# Qai remote validation runbook

This build is a temporary real-user validation environment. It is intentionally separate from Qai's future production authentication, subscription, and team model.

## Architecture and safety boundary

- Founder access uses a dedicated server-only credential and an eight-hour signed, HTTP-only cookie.
- Test codes and one-click invite tokens are hashed with a server-side secret before storage. Invite tokens are removed from the URL during exchange.
- Tester access uses a revocable, workspace-bound server session. Server routes derive the workspace from that validated session; browser-supplied workspace IDs are never authorization input.
- Completed localhost collections are mirrored into `validation_workspace_documents` under the session workspace. Qai Space records, Requests, media, Calendar tokens, event mappings, and invoice sequences have dedicated workspace-scoped tables.
- Validation tables have RLS enabled, no anon/authenticated policies, and revoked direct grants. Only Qai server routes use the service role.
- Google access and refresh tokens are encrypted with AES-256-GCM before database storage. Calendar OAuth is separate from tester access.
- This environment is suitable for copied validation data, not regulated, uniquely sensitive, or irreplaceable production records.

## Apply migrations

Apply migrations in order to the existing validation project (`zoovtjqjqvhfuhlxaiwx`):

1. `202608100001_commercial_foundation.sql`
2. `202608110001_remote_validation.sql`

Use the Supabase migration workflow. Do not reset the database, drop schemas, or run destructive seed scripts. After applying, verify migration history, validation-table RLS, revoked anon/authenticated grants, the private `validation-media` bucket, and the invoice allocation function grant.

## Vercel environment

Set these for the validation deployment. Generate independent high-entropy values for every secret.

```text
NEXT_PUBLIC_SUPABASE_URL=https://zoovtjqjqvhfuhlxaiwx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project publishable key>
SUPABASE_SERVICE_ROLE_KEY=<server-only service role key>
NEXT_PUBLIC_QAI_CLOUD_ENABLED=false
NEXT_PUBLIC_QAI_VALIDATION_ENABLED=true
NEXT_PUBLIC_APP_URL=https://qai-two.vercel.app
QAI_VALIDATION_ADMIN_SECRET=<founder-only credential>
QAI_VALIDATION_SESSION_SECRET=<at least 32 random characters>
QAI_VALIDATION_TOKEN_ENCRYPTION_KEY=<at least 32 random characters, independent from session secret>
GOOGLE_CLIENT_ID=<Google OAuth web client ID, when Calendar validation is enabled>
GOOGLE_CLIENT_SECRET=<Google OAuth web client secret, server-only>
GOOGLE_REDIRECT_URI=https://qai-two.vercel.app/api/integrations/google-calendar/callback
```

Do not use `NEXT_PUBLIC_` for the service role, founder credential, session secret, encryption key, or Google client secret. Do not paste secret values into source, logs, screenshots, test fixtures, or issue trackers.

## Google OAuth validation setup

1. Enable Google Calendar API in the founder-owned Google Cloud project.
2. Create a Web application OAuth client and add the exact redirect URI shown above.
3. Keep the consent screen in Testing and add only approved validation accounts as test users.
4. Qai requests only `calendar.events` and `calendar.calendarlist.readonly` for this feature.
5. Test connect, writable-calendar selection, multi-schedule sync, edit/update, future cancellation, reconnect, and disconnect with a non-critical calendar.

Qai is the source of truth. This sprint does not import arbitrary personal events, create Qai bookings from Google events, use webhooks, or provide two-way synchronization.

## Founder validation flow

1. Open `/validation/founder/login` and enter the founder credential.
2. Create a workspace using the freelancer/business label.
3. Copy the newly generated one-click invite immediately. Raw codes and invite tokens are intentionally not recoverable later.
4. Send the invite. It is single-use and expires after 14 days.
5. Generate another invite for another first device. The short test code remains the fallback for the same workspace on a second device.
6. Disable a workspace to revoke active sessions. Regenerating a code also revokes active sessions. Reset removes business validation data and media while keeping the workspace. Delete removes the workspace and its records.

The founder manager is intentionally absent from normal navigation.

## Pre-deployment verification

Run:

```text
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
npm audit --omit=dev
```

Then validate independent browser contexts for founder, Workspace A, Workspace B, and a public customer. Confirm invite removal from the URL, second-device continuity, cross-workspace denial, public Request ownership, portfolio delivery, import idempotency, invoice revision history, and Calendar event mapping.

## Known validation-only limitations

- No production signup, password recovery, email verification, commercial billing, team roles, or user account lifecycle.
- Whole local collections are mirrored per workspace for compatibility with the completed MVP. Production should move every domain to normalized, transactional repositories and production Auth/RLS claims.
- Calendar sync is manual one-way Qai Schedule to Google event sync. It is not an availability engine or two-way calendar platform.
- Uploaded signature/stamp images are visual business marks only, not certified or cryptographic electronic signatures.
- Invoice revisions preserve issued snapshots but this sprint does not implement credit notes, refunds, or formal accounting ledgers.
- The spreadsheet importer targets common Qai business sheets, not arbitrary accounting workbooks or AI interpretation.
