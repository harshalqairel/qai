-- Service availability is optional, backward-compatible configuration. Existing
-- services remain flexible and single-capacity until an owner opts in.

alter table public.services
  add column if not exists availability jsonb not null default jsonb_build_object(
    'mode', 'Flexible',
    'capacityMode', 'One booking',
    'defaultCapacity', 1,
    'recurringTimes', '[]'::jsonb,
    'datedSessions', '[]'::jsonb,
    'overrides', '[]'::jsonb
  );

-- Capacity identity is snapshotted on the Booking so later edits to a Service,
-- its timezone, or its availability rules cannot reinterpret a reservation.
alter table public.bookings
  add column if not exists capacity_source_request_id text,
  add column if not exists capacity_slot_keys jsonb not null default '[]'::jsonb;

alter table public.bookings
  drop constraint if exists bookings_capacity_source_request_id_check,
  drop constraint if exists bookings_capacity_slot_keys_check;

alter table public.bookings
  add constraint bookings_capacity_source_request_id_check
    check (capacity_source_request_id is null or char_length(capacity_source_request_id) between 1 and 100),
  add constraint bookings_capacity_slot_keys_check
    check (jsonb_typeof(capacity_slot_keys) = 'array'
      and jsonb_array_length(capacity_slot_keys) <= 50
      and not jsonb_path_exists(capacity_slot_keys, '$[*] ? (@.type() != "string")'));

create or replace function public.save_booking_with_questionnaire(booking_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking_id uuid;
  responses jsonb;
  selection_snapshot jsonb;
  slot_keys jsonb;
  source_request_id text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  responses := coalesce(booking_payload->'questionnaire_responses', '[]'::jsonb);
  if jsonb_typeof(responses) <> 'array' or jsonb_array_length(responses) > 50 then
    raise exception 'Invalid questionnaire responses';
  end if;

  selection_snapshot := coalesce(booking_payload->'service_snapshot', '{}'::jsonb);
  if jsonb_typeof(selection_snapshot) <> 'object' then
    raise exception 'Invalid service selection snapshot';
  end if;

  slot_keys := coalesce(booking_payload->'capacity_slot_keys', '[]'::jsonb);
  if jsonb_typeof(slot_keys) <> 'array' or jsonb_array_length(slot_keys) > 50
    or exists (
      select 1 from jsonb_array_elements(slot_keys) as item(value)
      where jsonb_typeof(item.value) <> 'string'
        or char_length(item.value #>> '{}') not between 1 and 2048
    )
  then
    raise exception 'Invalid capacity slot keys';
  end if;

  source_request_id := nullif(btrim(booking_payload->>'capacity_source_request_id'), '');
  if source_request_id is not null and char_length(source_request_id) > 100 then
    raise exception 'Invalid capacity source request';
  end if;

  target_booking_id := public.save_booking(booking_payload);

  update public.bookings booking
  set questionnaire_responses = responses,
      service_snapshot = selection_snapshot,
      capacity_source_request_id = source_request_id,
      capacity_slot_keys = slot_keys
  where booking.id = target_booking_id
    and (select public.is_business_member(booking.business_id));

  if not found then
    raise exception 'Booking belongs to another business';
  end if;

  return target_booking_id;
end;
$$;

revoke all on function public.save_booking_with_questionnaire(jsonb) from public, anon;
grant execute on function public.save_booking_with_questionnaire(jsonb) to authenticated;

alter table public.services
  drop constraint if exists services_availability_object_check;

alter table public.services
  add constraint services_availability_object_check
  check (coalesce(
    jsonb_typeof(availability) = 'object'
    and availability->>'mode' in ('Flexible', 'Recurring times', 'Dated sessions')
    and availability->>'capacityMode' in ('One booking', 'Multiple bookings')
    and case
      when jsonb_typeof(availability->'defaultCapacity') = 'number'
        and availability->>'defaultCapacity' ~ '^[0-9]+$'
      then (availability->>'defaultCapacity')::integer between 1 and 10000
      else false
    end
    and jsonb_typeof(availability->'recurringTimes') = 'array'
    and jsonb_array_length(availability->'recurringTimes') <= 100
    and jsonb_typeof(availability->'datedSessions') = 'array'
    and jsonb_array_length(availability->'datedSessions') <= 500
    and jsonb_typeof(availability->'overrides') = 'array'
    and jsonb_array_length(availability->'overrides') <= 500,
    false
  ));

-- Claiming a public request is the capacity boundary. Advisory transaction
-- locks serialize claims for the same workspace/session without exposing the
-- validation tables or this function to browser roles.
create or replace function public.claim_validation_request_capacity(
  target_workspace_id uuid,
  target_request_id uuid,
  target_slots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_payload jsonb;
  request_service_id text;
  slot jsonb;
  slot_key text;
  slot_date text;
  slot_start_time text;
  slot_capacity integer;
  slot_blocked integer;
  existing_bookings integer;
  accepted_requests integer;
  replaced_request_ids jsonb;
begin
  if jsonb_typeof(coalesce(target_slots, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_CAPACITY_SLOTS';
  end if;

  select request.payload
    into request_payload
  from public.validation_public_requests as request
  where request.workspace_id = target_workspace_id
    and request.id = target_request_id
  for update;

  if request_payload is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if request_payload->>'status' = 'Declined' then
    raise exception 'REQUEST_DECLINED';
  end if;
  if request_payload->>'status' = 'Accepted' then
    return request_payload;
  end if;
  request_service_id := request_payload->>'serviceId';
  if request_service_id is null or char_length(request_service_id) not between 1 and 100 then
    raise exception 'INVALID_CAPACITY_SLOT';
  end if;

  for slot in
    select item
    from jsonb_array_elements(coalesce(target_slots, '[]'::jsonb)) as items(item)
    order by item->>'key'
  loop
    slot_key := slot->>'key';
    slot_date := slot->>'date';
    slot_start_time := slot->>'startTime';
    slot_capacity := greatest(1, coalesce((slot->>'capacity')::integer, 1));
    slot_blocked := greatest(0, coalesce((slot->>'manualBlocked')::integer, 0));
    existing_bookings := greatest(0, coalesce((slot->>'existingBookings')::integer, 0));
    replaced_request_ids := coalesce(slot->'replacedRequestIds', '[]'::jsonb);
    if slot->>'serviceId' is distinct from request_service_id
      or slot_key is null
      or char_length(slot_key) not between 1 and 2048
      or slot_key !~ '\|[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$'
      or slot_date is null
      or slot_date !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or slot_start_time is null
      or slot_start_time !~ '^[0-9]{2}:[0-9]{2}$'
      or right(slot_key, 16) <> slot_date || 'T' || slot_start_time
      or jsonb_typeof(replaced_request_ids) <> 'array'
      or exists (
        select 1 from jsonb_array_elements(replaced_request_ids) as replaced(value)
        where jsonb_typeof(replaced.value) <> 'string'
          or char_length(replaced.value #>> '{}') not between 1 and 100
      )
    then
      raise exception 'INVALID_CAPACITY_SLOT';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(target_workspace_id::text || ':' || request_service_id || ':' || slot_key, 0));

    select count(*)::integer
      into accepted_requests
    from public.validation_public_requests as request
    where request.workspace_id = target_workspace_id
      and request.id <> target_request_id
      and request.payload->>'status' = 'Accepted'
      and request.payload->>'serviceId' = request_service_id
      and nullif(request.payload->>'bookingId', '') is null
      and not (replaced_request_ids ? request.id::text)
      and (
        coalesce(request.payload->'availabilityKeys', '[]'::jsonb) ? slot_key
        or request.payload->>'availabilityKey' = slot_key
        or exists (
          select 1
          from jsonb_array_elements(coalesce(request.payload->'schedules', '[]'::jsonb)) as schedule(value)
          where schedule.value->>'date' = slot_date
            and schedule.value->>'startTime' = slot_start_time
        )
      );

    if accepted_requests + existing_bookings + slot_blocked >= slot_capacity then
      raise exception 'SESSION_FULL';
    end if;
  end loop;

  request_payload := jsonb_set(
    jsonb_set(request_payload, '{status}', '"Accepted"'::jsonb, true),
    '{updatedAt}',
    to_jsonb(floor(extract(epoch from clock_timestamp()) * 1000)::bigint),
    true
  );

  update public.validation_public_requests
  set payload = request_payload,
      updated_at = now()
  where workspace_id = target_workspace_id
    and id = target_request_id;

  return request_payload;
end;
$$;

revoke all on function public.claim_validation_request_capacity(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_validation_request_capacity(uuid, uuid, jsonb) to service_role;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  validation_workspace_id uuid references public.validation_workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 1 and 4096 and endpoint ~ '^https://'),
  expiration_time bigint check (expiration_time is null or expiration_time > 0),
  p256dh text not null check (char_length(p256dh) between 1 and 512 and p256dh ~ '^[A-Za-z0-9_-]+={0,2}$'),
  auth text not null check (char_length(auth) between 1 and 512 and auth ~ '^[A-Za-z0-9_-]+={0,2}$'),
  categories text[] not null default '{}',
  user_agent text not null default '' check (char_length(user_agent) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (business_id is not null and validation_workspace_id is null and user_id is not null)
    or (business_id is null and validation_workspace_id is not null and user_id is null)
  ),
  check (categories <@ array['bookingRequests', 'bookingChanges', 'upcomingSchedules', 'paymentDue', 'invoiceDue', 'calendarProblems']::text[]),
  unique (business_id, user_id, endpoint),
  unique (validation_workspace_id, endpoint)
);

create index if not exists push_subscriptions_business_user_idx
  on public.push_subscriptions(business_id, user_id);
create index if not exists push_subscriptions_validation_workspace_idx
  on public.push_subscriptions(validation_workspace_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_owner_access on public.push_subscriptions;
create policy push_subscriptions_owner_access
on public.push_subscriptions
for all
to authenticated
using (
  user_id = (select auth.uid())
  and business_id is not null
  and (select public.is_business_member(business_id))
)
with check (
  user_id = (select auth.uid())
  and business_id is not null
  and validation_workspace_id is null
  and (select public.is_business_member(business_id))
);

revoke all on table public.push_subscriptions from public, anon;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

-- The VAPID private key remains server-only. Validation workspace subscriptions
-- are accessed only by service_role; browser roles cannot query those rows.
-- This migration is intentionally created but not applied by this task.
