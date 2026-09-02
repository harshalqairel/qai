-- Durable Qai Space publishing for real cloud businesses. Validation tables
-- remain isolated and are intentionally not reused by this feature.

create table if not exists public.qai_space_pages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) <= 60),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  unique (slug),
  unique (business_id, id)
);

create table if not exists public.qai_space_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  page_id uuid not null,
  page_slug text not null,
  service_id uuid not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, idempotency_key),
  foreign key (business_id, page_id) references public.qai_space_pages(business_id, id) on delete cascade,
  foreign key (business_id, service_id) references public.services(business_id, id)
);

create index if not exists qai_space_requests_business_created_idx
  on public.qai_space_requests(business_id, created_at desc);
create index if not exists qai_space_requests_business_service_idx
  on public.qai_space_requests(business_id, service_id);

create table if not exists public.qai_space_media_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('page-logo', 'page-cover', 'portfolio', 'booking-response')),
  storage_path text not null check (char_length(storage_path) between 1 and 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 8388608),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (storage_path)
);

create index if not exists qai_space_media_assets_business_kind_idx
  on public.qai_space_media_assets(business_id, kind);

alter table public.qai_space_pages enable row level security;
alter table public.qai_space_requests enable row level security;
alter table public.qai_space_media_assets enable row level security;

drop policy if exists qai_space_pages_member_access on public.qai_space_pages;
create policy qai_space_pages_member_access on public.qai_space_pages
  for all to authenticated
  using ((select public.is_business_member(business_id)))
  with check ((select public.is_business_member(business_id)));

drop policy if exists qai_space_requests_member_access on public.qai_space_requests;
create policy qai_space_requests_member_access on public.qai_space_requests
  for all to authenticated
  using ((select public.is_business_member(business_id)))
  with check ((select public.is_business_member(business_id)));

drop policy if exists qai_space_media_assets_member_access on public.qai_space_media_assets;
create policy qai_space_media_assets_member_access on public.qai_space_media_assets
  for all to authenticated
  using ((select public.is_business_member(business_id)))
  with check ((select public.is_business_member(business_id)));

revoke all on table public.qai_space_pages from public, anon;
revoke all on table public.qai_space_requests from public, anon;
revoke all on table public.qai_space_media_assets from public, anon;
grant select, insert, update, delete on table public.qai_space_pages to authenticated, service_role;
grant select, insert, update, delete on table public.qai_space_requests to authenticated, service_role;
grant select, insert, update, delete on table public.qai_space_media_assets to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qai-space-media',
  'qai-space-media',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists qai_space_media_select_members on storage.objects;
create policy qai_space_media_select_members on storage.objects
  for select to authenticated
  using (
    bucket_id = 'qai-space-media'
    and (select public.is_business_member(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists qai_space_media_insert_members on storage.objects;
create policy qai_space_media_insert_members on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'qai-space-media'
    and (select public.is_business_member(((storage.foldername(name))[1])::uuid))
  );

drop policy if exists qai_space_media_delete_members on storage.objects;
create policy qai_space_media_delete_members on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'qai-space-media'
    and (select public.is_business_member(((storage.foldername(name))[1])::uuid))
  );

-- Normalize Additional Charge category identity inside the same transaction as
-- Booking, schedules, questionnaire answers, and charges. A stale local label
-- can never reach the UUID cast in the older writer.
create or replace function public.save_booking_with_integrity(booking_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_business_id uuid;
  normalized_payload jsonb;
  normalized_charges jsonb := '[]'::jsonb;
  charge_record jsonb;
  resolved_category_id uuid;
  category_name text;
  supplied_category_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if jsonb_typeof(booking_payload) <> 'object'
    or jsonb_typeof(coalesce(booking_payload->'additional_charges', '[]'::jsonb)) <> 'array'
  then
    raise exception 'Invalid booking payload';
  end if;

  select membership.business_id into target_business_id
  from public.business_memberships membership
  where membership.user_id = (select auth.uid())
  order by membership.created_at
  limit 1;
  if target_business_id is null then
    raise exception 'Business membership required';
  end if;

  for charge_record in
    select value from jsonb_array_elements(coalesce(booking_payload->'additional_charges', '[]'::jsonb))
  loop
    resolved_category_id := null;
    category_name := btrim(coalesce(charge_record->>'category_name', ''));
    supplied_category_id := charge_record->>'category_id';
    if category_name = '' or char_length(category_name) > 80 then
      raise exception 'Invalid Additional Charge category';
    end if;

    if supplied_category_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      select category.id into resolved_category_id
      from public.additional_charge_categories category
      where category.business_id = target_business_id
        and category.id = supplied_category_id::uuid;
    end if;

    if resolved_category_id is null then
      select category.id into resolved_category_id
      from public.additional_charge_categories category
      where category.business_id = target_business_id
        and category.normalized_name = lower(category_name);
    end if;

    if resolved_category_id is null then
      insert into public.additional_charge_categories (id, business_id, name)
      values (gen_random_uuid(), target_business_id, category_name)
      on conflict (business_id, normalized_name) do update set name = excluded.name
      returning id into resolved_category_id;
    end if;

    normalized_charges := normalized_charges || jsonb_build_array(
      jsonb_set(charge_record, '{category_id}', to_jsonb(resolved_category_id::text), true)
    );
  end loop;

  normalized_payload := jsonb_set(booking_payload, '{additional_charges}', normalized_charges, true);
  return public.save_booking_with_questionnaire(normalized_payload);
end;
$$;

revoke all on function public.save_booking_with_integrity(jsonb) from public, anon;
grant execute on function public.save_booking_with_integrity(jsonb) to authenticated;

-- Capacity is consumed at owner acceptance, not at pending submission. The
-- advisory lock serializes all acceptances for one stable business/service/slot
-- key, while linked or converted requests are counted exactly once.
create or replace function public.claim_qai_space_request_capacity(
  target_request_id uuid,
  target_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_business_id uuid;
  request_payload jsonb;
  request_service_id uuid;
  slot jsonb;
  slot_key text;
  slot_date text;
  slot_start_time text;
  slot_capacity integer;
  slot_reserved integer;
  booking_count integer;
  accepted_request_count integer;
begin
  if jsonb_typeof(coalesce(target_slots, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_CAPACITY_SLOTS';
  end if;

  select request.business_id, request.payload
    into target_business_id, request_payload
  from public.qai_space_requests request
  where request.id = target_request_id
  for update;
  if request_payload is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  if request_payload->>'status' = 'Declined' then raise exception 'REQUEST_DECLINED'; end if;
  if request_payload->>'status' = 'Accepted' then return request_payload; end if;
  request_service_id := (request_payload->>'serviceId')::uuid;

  for slot in
    select item from jsonb_array_elements(coalesce(target_slots, '[]'::jsonb)) as items(item)
    order by item->>'key'
  loop
    slot_key := slot->>'key';
    slot_date := slot->>'date';
    slot_start_time := slot->>'startTime';
    slot_capacity := greatest(1, coalesce((slot->>'capacity')::integer, 1));
    slot_reserved := greatest(0, coalesce((slot->>'manualBlocked')::integer, 0));
    if coalesce(slot->>'serviceId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (slot->>'serviceId')::uuid is distinct from request_service_id
      or slot_key is null or char_length(slot_key) not between 1 and 2048
      or slot_key !~ '\|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
      or slot_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or slot_start_time !~ '^[0-9]{2}:[0-9]{2}$'
      or right(slot_key, 16) <> slot_date || 'T' || slot_start_time
    then
      raise exception 'INVALID_CAPACITY_SLOT';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(target_business_id::text || ':' || request_service_id::text || ':' || slot_key, 0));

    select count(*)::integer into booking_count
    from public.bookings booking
    where booking.business_id = target_business_id
      and booking.service_id = request_service_id
      and booking.booking_status <> 'Cancelled'
      and coalesce(booking.capacity_slot_keys, '[]'::jsonb) ? slot_key;

    select count(*)::integer into accepted_request_count
    from public.qai_space_requests request
    where request.business_id = target_business_id
      and request.id <> target_request_id
      and request.service_id = request_service_id
      and request.payload->>'status' = 'Accepted'
      and nullif(request.payload->>'bookingId', '') is null
      and not exists (
        select 1 from public.bookings converted
        where converted.business_id = target_business_id
          and converted.capacity_source_request_id = request.id::text
      )
      and (
        coalesce(request.payload->'availabilityKeys', '[]'::jsonb) ? slot_key
        or request.payload->>'availabilityKey' = slot_key
      );

    if booking_count + accepted_request_count + slot_reserved >= slot_capacity then
      raise exception 'SESSION_FULL';
    end if;
  end loop;

  request_payload := jsonb_set(
    jsonb_set(request_payload, '{status}', '"Accepted"'::jsonb, true),
    '{updatedAt}',
    to_jsonb(floor(extract(epoch from clock_timestamp()) * 1000)::bigint),
    true
  );
  update public.qai_space_requests
  set payload = request_payload, updated_at = now()
  where business_id = target_business_id and id = target_request_id;
  return request_payload;
end;
$$;

revoke all on function public.claim_qai_space_request_capacity(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_qai_space_request_capacity(uuid, jsonb) to service_role;

create or replace function public.reserve_qai_space_instant_request(
  target_business_id uuid,
  target_page_id uuid,
  target_slot_id text,
  target_request_id uuid,
  target_request_payload jsonb,
  target_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  page_payload jsonb;
  updated_slots jsonb;
  matching_slots integer;
  existing_payload jsonb;
begin
  select request.payload into existing_payload
  from public.qai_space_requests request
  where request.business_id = target_business_id
    and request.idempotency_key = target_idempotency_key;
  if existing_payload is not null then return existing_payload; end if;

  select page.payload into page_payload
  from public.qai_space_pages page
  where page.business_id = target_business_id and page.id = target_page_id
  for update;
  if page_payload is null then raise exception 'PAGE_NOT_FOUND'; end if;

  select count(*)::integer,
         jsonb_agg(
           case when slot->>'id' = target_slot_id and slot->>'status' = 'Available'
             then slot || jsonb_build_object('status', 'Reserved', 'requestId', target_request_id::text)
             else slot end
           order by ordinal
         )
    into matching_slots, updated_slots
  from jsonb_array_elements(coalesce(page_payload->'slots', '[]'::jsonb)) with ordinality as slots(slot, ordinal)
  where true;

  select count(*)::integer into matching_slots
  from jsonb_array_elements(coalesce(page_payload->'slots', '[]'::jsonb)) as slots(slot)
  where slot->>'id' = target_slot_id and slot->>'status' = 'Available';
  if matching_slots <> 1 then raise exception 'SLOT_TAKEN'; end if;

  page_payload := jsonb_set(page_payload, '{slots}', coalesce(updated_slots, '[]'::jsonb), true);
  update public.qai_space_pages set payload = page_payload, updated_at = now()
  where business_id = target_business_id and id = target_page_id;

  insert into public.qai_space_requests (id, business_id, page_id, page_slug, service_id, payload, idempotency_key)
  values (
    target_request_id,
    target_business_id,
    target_page_id,
    target_request_payload->>'slug',
    (target_request_payload->>'serviceId')::uuid,
    target_request_payload,
    target_idempotency_key
  );
  return target_request_payload;
end;
$$;

revoke all on function public.reserve_qai_space_instant_request(uuid, uuid, text, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.reserve_qai_space_instant_request(uuid, uuid, text, uuid, jsonb, text) to service_role;

-- Public reads, public booking submission, and privileged capacity claims flow
-- only through server routes. No table, bucket, or RPC permission is granted to
-- anon, and the service-role key never enters the browser bundle.
