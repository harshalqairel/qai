-- Google Calendar cloud synchronization schema and credential boundary.
--
-- This migration intentionally provides only the durable database foundation.
-- Product routes and reconciliation behavior are implemented separately after
-- this schema has been validated against qai-dev.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_extension extension_record
    where extension_record.extname = 'supabase_vault'
  ) then
    raise exception 'Supabase Vault is required for Google Calendar credentials';
  end if;
end;
$$;

-- OAuth state is deliberately browser-inaccessible. The raw state is never
-- stored; the PKCE verifier lives in Vault for only as long as the state is
-- usable. The composite membership FK binds every state to both its business
-- and its initiating user.
create table public.google_calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  user_id uuid not null,
  state_hash text not null,
  pkce_verifier_secret_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint google_calendar_oauth_states_membership_fkey
    foreign key (business_id, user_id)
    references public.business_memberships(business_id, user_id)
    on delete cascade,
  constraint google_calendar_oauth_states_state_hash_key unique (state_hash),
  constraint google_calendar_oauth_states_pkce_secret_key unique (pkce_verifier_secret_id),
  constraint google_calendar_oauth_states_state_hash_check
    check (
      state_hash = btrim(state_hash)
      and char_length(state_hash) between 32 and 128
    ),
  constraint google_calendar_oauth_states_expiry_check
    check (expires_at > created_at),
  constraint google_calendar_oauth_states_consumed_check
    check (consumed_at is null or consumed_at >= created_at),
  constraint google_calendar_oauth_states_pkce_lifecycle_check
    check (
      (consumed_at is null and pkce_verifier_secret_id is not null)
      or (consumed_at is not null and pkce_verifier_secret_id is null)
    )
);

create index google_calendar_oauth_states_business_expiry_idx
  on public.google_calendar_oauth_states(business_id, user_id, expires_at)
  where consumed_at is null;

alter table public.google_calendar_oauth_states enable row level security;

-- No policies are created: OAuth state is accessed only through the narrowly
-- granted SECURITY DEFINER functions below.
revoke all on table public.google_calendar_oauth_states
  from public, anon, authenticated, service_role;

-- Distinguish successful reconciliation from an attempted reconciliation.
alter table public.integrations
  add column last_sync_at timestamptz,
  add column last_sync_attempt_at timestamptz,
  add column last_error text;

alter table public.integrations
  drop constraint integrations_status_check;

alter table public.integrations
  add constraint integrations_status_check
  check (status in ('connected', 'disconnected', 'error', 'reconnect_required'));

alter table public.integrations
  add constraint integrations_last_error_check
  check (last_error is null or char_length(last_error) <= 2000);

create unique index integrations_credential_secret_id_key
  on public.integrations(credential_secret_id)
  where credential_secret_id is not null;

comment on column public.integrations.last_sync_at is
  'Timestamp of the most recent fully successful Google Calendar reconciliation. Partial failures must not advance it.';
comment on column public.integrations.last_sync_attempt_at is
  'Timestamp of the most recent attempted Google Calendar reconciliation, successful or not.';
comment on column public.integrations.last_error is
  'Sanitized integration-level error summary. Never stores credentials or provider response bodies containing secrets.';

-- Preserve the source session and the calendar that owns the external event.
-- Existing rows are staged through nullable columns before constraints are
-- enforced. The pre-application audit found no rows on qai-dev; the guard still
-- makes the migration fail safely rather than inventing an ambiguous calendar.
alter table public.calendar_event_links
  add column source_booking_session_id uuid,
  add column external_calendar_id text,
  add column last_payload_hash text,
  add column last_error text;

update public.calendar_event_links
set source_booking_session_id = booking_session_id
where source_booking_session_id is null;

update public.calendar_event_links link
set external_calendar_id = integration.destination_id
from public.integrations integration
where integration.business_id = link.business_id
  and integration.id = link.integration_id
  and link.external_calendar_id is null
  and integration.destination_id is not null
  and btrim(integration.destination_id) <> '';

do $$
begin
  if exists (
    select 1
    from public.calendar_event_links link
    where link.source_booking_session_id is null
       or link.external_calendar_id is null
       or btrim(link.external_calendar_id) = ''
  ) then
    raise exception 'Calendar event links require an unambiguous source session and external calendar before migration';
  end if;
end;
$$;

alter table public.calendar_event_links
  alter column source_booking_session_id set not null,
  alter column external_calendar_id set not null,
  alter column booking_session_id drop not null;

alter table public.calendar_event_links
  drop constraint calendar_event_links_business_id_booking_session_id_fkey,
  drop constraint calendar_event_links_business_id_integration_id_booking_ses_key,
  drop constraint calendar_event_links_business_id_integration_id_external_ev_key;

alter table public.calendar_event_links
  add constraint calendar_event_links_business_id_booking_session_id_fkey
    foreign key (business_id, booking_session_id)
    references public.booking_sessions(business_id, id)
    on delete set null (booking_session_id),
  add constraint calendar_event_links_integration_source_session_key
    unique (integration_id, source_booking_session_id),
  add constraint calendar_event_links_external_event_key
    unique (integration_id, external_calendar_id, external_event_id),
  add constraint calendar_event_links_external_calendar_check
    check (btrim(external_calendar_id) <> '' and char_length(external_calendar_id) <= 1024),
  add constraint calendar_event_links_external_event_check
    check (btrim(external_event_id) <> '' and char_length(external_event_id) <= 1024),
  add constraint calendar_event_links_payload_hash_check
    check (
      last_payload_hash is null
      or (
        last_payload_hash = btrim(last_payload_hash)
        and char_length(last_payload_hash) between 32 and 128
      )
    ),
  add constraint calendar_event_links_last_error_check
    check (last_error is null or char_length(last_error) <= 2000);

create index calendar_event_links_reconciliation_idx
  on public.calendar_event_links(business_id, integration_id, sync_status, updated_at);

comment on column public.calendar_event_links.source_booking_session_id is
  'Stable Qai source-session identity. Intentionally has no FK so it survives deletion of the live Booking Session.';
comment on column public.calendar_event_links.booking_session_id is
  'Nullable live Booking Session reference. Session deletion sets only this column to NULL and preserves the mapping.';
comment on column public.calendar_event_links.external_calendar_id is
  'Calendar containing the external event. Stored per link so a later destination-calendar switch can reconcile the old event.';

-- Existing member policies remain in place, but direct Data API privileges are
-- explicitly removed. Calendar server routes use only these service-role grants.
revoke all on table public.integrations
  from public, anon, authenticated, service_role;
grant select, insert, update
  on table public.integrations
  to service_role;

revoke all on table public.calendar_event_links
  from public, anon, authenticated, service_role;
grant select, insert, update, delete
  on table public.calendar_event_links
  to service_role;

create or replace function public.create_google_calendar_oauth_state(
  target_business_id uuid,
  target_user_id uuid,
  target_state_hash text,
  target_pkce_verifier text,
  target_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_state_id uuid := gen_random_uuid();
  target_secret_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;

  if target_business_id is null
    or target_user_id is null
    or not exists (
      select 1
      from public.business_memberships membership
      where membership.business_id = target_business_id
        and membership.user_id = target_user_id
    )
  then
    raise exception 'Google Calendar OAuth membership is invalid';
  end if;

  if target_state_hash is null
    or target_state_hash <> btrim(target_state_hash)
    or char_length(target_state_hash) not between 32 and 128
  then
    raise exception 'Google Calendar OAuth state hash is invalid';
  end if;

  if target_pkce_verifier is null
    or target_pkce_verifier !~ '^[A-Za-z0-9._~-]{43,128}$'
  then
    raise exception 'Google Calendar PKCE verifier is invalid';
  end if;

  if target_expires_at is null
    or target_expires_at <= statement_timestamp()
    or target_expires_at > statement_timestamp() + interval '15 minutes'
  then
    raise exception 'Google Calendar OAuth expiry is invalid';
  end if;

  target_secret_id := vault.create_secret(
    target_pkce_verifier,
    'qai-google-calendar-pkce-' || target_state_id::text,
    'Ephemeral PKCE verifier for a Qai Google Calendar OAuth state',
    null
  );

  insert into public.google_calendar_oauth_states (
    id,
    business_id,
    user_id,
    state_hash,
    pkce_verifier_secret_id,
    expires_at
  ) values (
    target_state_id,
    target_business_id,
    target_user_id,
    target_state_hash,
    target_secret_id,
    target_expires_at
  );

  return target_state_id;
end;
$$;

create or replace function public.consume_google_calendar_oauth_state(
  target_business_id uuid,
  target_user_id uuid,
  target_state_hash text
)
returns table (
  oauth_state_id uuid,
  oauth_business_id uuid,
  oauth_user_id uuid,
  pkce_verifier text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  state_record public.google_calendar_oauth_states%rowtype;
  decrypted_verifier text;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;

  select oauth_state.*
  into state_record
  from public.google_calendar_oauth_states oauth_state
  where oauth_state.business_id = target_business_id
    and oauth_state.user_id = target_user_id
    and oauth_state.state_hash = target_state_hash
    and oauth_state.consumed_at is null
    and oauth_state.expires_at > statement_timestamp()
  for update;

  if not found then
    raise exception 'Google Calendar OAuth state is invalid, expired, consumed, or does not match';
  end if;

  select secret_record.decrypted_secret
  into decrypted_verifier
  from vault.decrypted_secrets secret_record
  where secret_record.id = state_record.pkce_verifier_secret_id
    and secret_record.name = 'qai-google-calendar-pkce-' || state_record.id::text;

  if decrypted_verifier is null
    or decrypted_verifier !~ '^[A-Za-z0-9._~-]{43,128}$'
  then
    raise exception 'Google Calendar OAuth verifier is unavailable';
  end if;

  update public.google_calendar_oauth_states oauth_state
  set consumed_at = statement_timestamp(),
      pkce_verifier_secret_id = null
  where oauth_state.id = state_record.id;

  delete from vault.secrets secret_record
  where secret_record.id = state_record.pkce_verifier_secret_id
    and secret_record.name = 'qai-google-calendar-pkce-' || state_record.id::text;

  return query
  select
    state_record.id,
    state_record.business_id,
    state_record.user_id,
    decrypted_verifier;
end;
$$;

create or replace function public.remove_google_calendar_oauth_state_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.pkce_verifier_secret_id is not null then
    delete from vault.secrets secret_record
    where secret_record.id = old.pkce_verifier_secret_id
      and secret_record.name = 'qai-google-calendar-pkce-' || old.id::text;
  end if;
  return old;
end;
$$;

create trigger remove_google_calendar_oauth_state_secret
after delete on public.google_calendar_oauth_states
for each row execute function public.remove_google_calendar_oauth_state_secret();

create or replace function public.store_google_calendar_credentials(
  target_business_id uuid,
  target_integration_id uuid,
  credential_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_secret_id uuid;
  target_secret_name text := 'qai-google-calendar-' || target_integration_id::text;
  existing_secret_name text;
  existing_payload jsonb := '{}'::jsonb;
  merged_payload jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;

  if credential_payload is null
    or jsonb_typeof(credential_payload) <> 'object'
    or octet_length(credential_payload::text) > 65536
  then
    raise exception 'Google Calendar credential payload is invalid';
  end if;

  if credential_payload ? 'access_token'
    and (
      jsonb_typeof(credential_payload->'access_token') <> 'string'
      or btrim(credential_payload->>'access_token') = ''
    )
  then
    raise exception 'Google Calendar access token is invalid';
  end if;

  if credential_payload ? 'refresh_token'
    and (
      jsonb_typeof(credential_payload->'refresh_token') <> 'string'
      or btrim(credential_payload->>'refresh_token') = ''
    )
  then
    raise exception 'Google Calendar refresh token is invalid';
  end if;

  select integration.credential_secret_id
  into target_secret_id
  from public.integrations integration
  where integration.business_id = target_business_id
    and integration.id = target_integration_id
    and integration.provider = 'google_calendar'
  for update;

  if not found then
    raise exception 'Google Calendar integration not found';
  end if;

  if target_secret_id is not null then
    select secret_record.name, secret_record.decrypted_secret::jsonb
    into existing_secret_name, existing_payload
    from vault.decrypted_secrets secret_record
    where secret_record.id = target_secret_id;

    if not found or existing_secret_name is distinct from target_secret_name then
      raise exception 'Google Calendar credential secret is unavailable';
    end if;
  end if;

  merged_payload := existing_payload || jsonb_strip_nulls(credential_payload);

  if coalesce(btrim(merged_payload->>'access_token'), '') = ''
    and coalesce(btrim(merged_payload->>'refresh_token'), '') = ''
  then
    raise exception 'Google Calendar credentials require a token';
  end if;

  if target_secret_id is null then
    target_secret_id := vault.create_secret(
      merged_payload::text,
      target_secret_name,
      'OAuth credentials for a Qai Google Calendar integration',
      null
    );
  else
    perform vault.update_secret(
      target_secret_id,
      merged_payload::text,
      target_secret_name,
      'OAuth credentials for a Qai Google Calendar integration',
      null
    );
  end if;

  update public.integrations integration
  set credential_secret_id = target_secret_id
  where integration.business_id = target_business_id
    and integration.id = target_integration_id
    and integration.provider = 'google_calendar';

  return target_secret_id;
exception
  when invalid_text_representation then
    raise exception 'Google Calendar credential secret is unavailable';
end;
$$;

create or replace function public.read_google_calendar_credentials(
  target_business_id uuid,
  target_integration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  credential_payload jsonb;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;

  select secret_record.decrypted_secret::jsonb
  into credential_payload
  from public.integrations integration
  join vault.decrypted_secrets secret_record
    on secret_record.id = integration.credential_secret_id
   and secret_record.name = 'qai-google-calendar-' || integration.id::text
  where integration.business_id = target_business_id
    and integration.id = target_integration_id
    and integration.provider = 'google_calendar';

  if not found or jsonb_typeof(credential_payload) <> 'object' then
    raise exception 'Google Calendar credentials are unavailable';
  end if;

  return credential_payload;
exception
  when invalid_text_representation then
    raise exception 'Google Calendar credentials are unavailable';
end;
$$;

create or replace function public.delete_google_calendar_credentials(
  target_business_id uuid,
  target_integration_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_secret_id uuid;
  target_secret_name text := 'qai-google-calendar-' || target_integration_id::text;
  existing_secret_name text;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role required';
  end if;

  select integration.credential_secret_id
  into target_secret_id
  from public.integrations integration
  where integration.business_id = target_business_id
    and integration.id = target_integration_id
    and integration.provider = 'google_calendar'
  for update;

  if not found then
    raise exception 'Google Calendar integration not found';
  end if;

  if target_secret_id is not null then
    select secret_record.name
    into existing_secret_name
    from vault.secrets secret_record
    where secret_record.id = target_secret_id;

    if found and existing_secret_name is distinct from target_secret_name then
      raise exception 'Google Calendar credential secret is unavailable';
    end if;
  end if;

  update public.integrations integration
  set credential_secret_id = null,
      status = 'disconnected',
      connected_at = null,
      last_error = null
  where integration.business_id = target_business_id
    and integration.id = target_integration_id
    and integration.provider = 'google_calendar';

  if target_secret_id is not null then
    delete from vault.secrets secret_record
    where secret_record.id = target_secret_id
      and secret_record.name = target_secret_name;
  end if;

  return target_secret_id is not null;
end;
$$;

revoke all on function public.create_google_calendar_oauth_state(uuid, uuid, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.consume_google_calendar_oauth_state(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.remove_google_calendar_oauth_state_secret()
  from public, anon, authenticated, service_role;
revoke all on function public.store_google_calendar_credentials(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.read_google_calendar_credentials(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_google_calendar_credentials(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.create_google_calendar_oauth_state(uuid, uuid, text, text, timestamptz)
  to service_role;
grant execute on function public.consume_google_calendar_oauth_state(uuid, uuid, text)
  to service_role;
grant execute on function public.store_google_calendar_credentials(uuid, uuid, jsonb)
  to service_role;
grant execute on function public.read_google_calendar_credentials(uuid, uuid)
  to service_role;
grant execute on function public.delete_google_calendar_credentials(uuid, uuid)
  to service_role;

comment on function public.create_google_calendar_oauth_state(uuid, uuid, text, text, timestamptz) is
  'Service-only creation of a business/user-bound hashed Google OAuth state with a Vault-protected PKCE verifier.';
comment on function public.consume_google_calendar_oauth_state(uuid, uuid, text) is
  'Atomically consumes one unexpired business/user-bound Google OAuth state, returns its PKCE verifier once, and removes that verifier from Vault.';
comment on function public.store_google_calendar_credentials(uuid, uuid, jsonb) is
  'Service-only upsert of a Google Calendar credential payload into Supabase Vault. Token patches preserve an existing refresh token when omitted.';
comment on function public.read_google_calendar_credentials(uuid, uuid) is
  'Service-only retrieval of one Google Calendar credential payload from Supabase Vault.';
comment on function public.delete_google_calendar_credentials(uuid, uuid) is
  'Service-only deletion of one Google Calendar credential secret and disconnection of its integration row.';

commit;
