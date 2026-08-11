-- Remote real-user validation infrastructure.
-- This is deliberately separate from production authentication. All access is
-- mediated by Qai server routes using the service role; anon/authenticated
-- clients receive no direct table privileges or RLS policies.

create table public.validation_workspaces (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  public_slug text not null unique check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  access_code_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_access_at timestamptz
);

create table public.validation_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.validation_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table public.validation_workspace_documents (
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  storage_key text not null check (storage_key ~ '^qai:' and char_length(storage_key) <= 160),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, storage_key)
);

create table public.validation_public_pages (
  workspace_id uuid primary key references public.validation_workspaces(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.validation_public_requests (
  id uuid primary key,
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  page_slug text not null,
  payload jsonb not null,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique nulls not distinct (workspace_id, idempotency_key)
);

create table public.validation_media_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  kind text not null check (kind in ('page-logo', 'page-cover', 'portfolio', 'invoice-logo', 'invoice-signature', 'invoice-stamp')),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 8388608),
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.validation_invoice_sequences (
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  prefix text not null,
  invoice_year integer not null,
  next_sequence integer not null default 1 check (next_sequence > 0),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, prefix, invoice_year)
);

create table public.validation_import_operations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  idempotency_key text not null,
  source_name text not null,
  source_hash text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create table public.validation_calendar_connections (
  workspace_id uuid primary key references public.validation_workspaces(id) on delete cascade,
  google_account_email text,
  target_calendar_id text,
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scope text,
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'reconnect_required')),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.validation_google_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  state_hash text not null unique,
  encrypted_code_verifier text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.validation_calendar_event_links (
  workspace_id uuid not null references public.validation_workspaces(id) on delete cascade,
  booking_id text not null,
  schedule_id text not null,
  google_calendar_id text not null,
  google_event_id text not null,
  last_payload_hash text not null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, schedule_id),
  unique (workspace_id, google_calendar_id, google_event_id)
);

create index validation_invites_workspace_idx on public.validation_invites(workspace_id);
create index validation_sessions_workspace_idx on public.validation_sessions(workspace_id);
create index validation_sessions_expiry_idx on public.validation_sessions(expires_at);
create index validation_requests_workspace_idx on public.validation_public_requests(workspace_id, created_at desc);
create index validation_media_workspace_idx on public.validation_media_assets(workspace_id, created_at desc);
create index validation_calendar_booking_idx on public.validation_calendar_event_links(workspace_id, booking_id);

alter table public.validation_workspaces enable row level security;
alter table public.validation_invites enable row level security;
alter table public.validation_sessions enable row level security;
alter table public.validation_workspace_documents enable row level security;
alter table public.validation_public_pages enable row level security;
alter table public.validation_public_requests enable row level security;
alter table public.validation_media_assets enable row level security;
alter table public.validation_invoice_sequences enable row level security;
alter table public.validation_import_operations enable row level security;
alter table public.validation_calendar_connections enable row level security;
alter table public.validation_calendar_event_links enable row level security;
alter table public.validation_google_oauth_states enable row level security;

revoke all on public.validation_workspaces from anon, authenticated;
revoke all on public.validation_invites from anon, authenticated;
revoke all on public.validation_sessions from anon, authenticated;
revoke all on public.validation_workspace_documents from anon, authenticated;
revoke all on public.validation_public_pages from anon, authenticated;
revoke all on public.validation_public_requests from anon, authenticated;
revoke all on public.validation_media_assets from anon, authenticated;
revoke all on public.validation_invoice_sequences from anon, authenticated;
revoke all on public.validation_import_operations from anon, authenticated;
revoke all on public.validation_calendar_connections from anon, authenticated;
revoke all on public.validation_calendar_event_links from anon, authenticated;
revoke all on public.validation_google_oauth_states from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'validation-media',
  'validation-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Atomic allocation prevents duplicate numbers across devices. Historical
-- invoices remain unchanged because this function only advances a sequence.
create or replace function public.allocate_validation_invoice_number(
  target_workspace_id uuid,
  target_prefix text,
  target_year integer,
  minimum_sequence integer default 1,
  padding integer default 4
)
returns table (invoice_number text, sequence_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocated integer;
  normalized_prefix text := upper(btrim(target_prefix));
begin
  if normalized_prefix !~ '^[A-Z0-9-]{1,12}$' then
    raise exception 'Invalid invoice prefix';
  end if;
  if target_year < 2000 or target_year > 2200 or minimum_sequence < 1 or padding < 1 or padding > 10 then
    raise exception 'Invalid invoice sequence settings';
  end if;
  if not exists (
    select 1 from public.validation_workspaces
    where id = target_workspace_id and status = 'active'
  ) then
    raise exception 'Workspace unavailable';
  end if;

  insert into public.validation_invoice_sequences (workspace_id, prefix, invoice_year, next_sequence)
  values (target_workspace_id, normalized_prefix, target_year, minimum_sequence + 1)
  on conflict (workspace_id, prefix, invoice_year) do update
  set next_sequence = greatest(public.validation_invoice_sequences.next_sequence, minimum_sequence) + 1,
      updated_at = now()
  returning next_sequence - 1 into allocated;

  return query select
    normalized_prefix || '-' || target_year::text || '-' || lpad(allocated::text, padding, '0'),
    allocated;
end;
$$;

revoke all on function public.allocate_validation_invoice_number(uuid, text, integer, integer, integer) from public;
grant execute on function public.allocate_validation_invoice_number(uuid, text, integer, integer, integer) to service_role;

-- Claiming an invitation and creating its session happen in one transaction so
-- a one-click token cannot create two sessions under concurrent requests.
create or replace function public.exchange_validation_invite(target_token_hash text, target_session_expires_at timestamptz)
returns table (workspace_id uuid, session_id uuid, session_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_workspace_id uuid;
  created_session_id uuid;
begin
  update public.validation_invites as invite
  set consumed_at = now()
  from public.validation_workspaces as workspace
  where invite.token_hash = target_token_hash
    and invite.workspace_id = workspace.id
    and invite.revoked_at is null
    and invite.consumed_at is null
    and invite.expires_at > now()
    and workspace.status = 'active'
  returning invite.workspace_id into claimed_workspace_id;
  if claimed_workspace_id is null then return; end if;

  insert into public.validation_sessions (workspace_id, expires_at)
  values (claimed_workspace_id, target_session_expires_at)
  returning id into created_session_id;

  return query select claimed_workspace_id, created_session_id, target_session_expires_at;
end;
$$;

revoke all on function public.exchange_validation_invite(text, timestamptz) from public;
grant execute on function public.exchange_validation_invite(text, timestamptz) to service_role;

-- Reserve one Instant Booking slot and persist its public request in one
-- transaction. The page row lock prevents two customers taking the same slot.
create or replace function public.reserve_validation_instant_request(
  target_workspace_id uuid,
  target_page_slug text,
  target_slot_id text,
  target_request_id uuid,
  target_request_payload jsonb,
  target_reserved_slot jsonb,
  target_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_page jsonb;
  current_slot jsonb;
  updated_slots jsonb;
  stored_request jsonb;
begin
  select page.payload
  into current_page
  from public.validation_public_pages as page
  where page.workspace_id = target_workspace_id and page.slug = target_page_slug
  for update;

  if current_page is null then raise exception 'PAGE_NOT_FOUND'; end if;

  select slot
  into current_slot
  from jsonb_array_elements(coalesce(current_page -> 'slots', '[]'::jsonb)) as slot
  where slot ->> 'id' = target_slot_id;

  if current_slot is null or current_slot ->> 'status' <> 'Available' then
    raise exception 'SLOT_TAKEN';
  end if;

  if target_reserved_slot ->> 'id' <> target_slot_id
    or target_reserved_slot ->> 'status' <> 'Reserved'
    or target_reserved_slot ->> 'requestId' <> target_request_id::text then
    raise exception 'INVALID_RESERVATION';
  end if;

  select jsonb_agg(case when slot ->> 'id' = target_slot_id then target_reserved_slot else slot end)
  into updated_slots
  from jsonb_array_elements(coalesce(current_page -> 'slots', '[]'::jsonb)) as slot;

  update public.validation_public_pages
  set payload = jsonb_set(current_page, '{slots}', updated_slots), updated_at = now()
  where workspace_id = target_workspace_id and slug = target_page_slug;

  insert into public.validation_public_requests (id, workspace_id, page_slug, payload, idempotency_key)
  values (target_request_id, target_workspace_id, target_page_slug, target_request_payload, target_idempotency_key)
  returning payload into stored_request;

  return stored_request;
exception
  when unique_violation then
    select request.payload
    into stored_request
    from public.validation_public_requests as request
    where request.workspace_id = target_workspace_id
      and request.idempotency_key = target_idempotency_key;
    if stored_request is not null then return stored_request; end if;
    raise;
end;
$$;

revoke all on function public.reserve_validation_instant_request(uuid, text, text, uuid, jsonb, jsonb, text) from public;
grant execute on function public.reserve_validation_instant_request(uuid, text, text, uuid, jsonb, jsonb, text) to service_role;
