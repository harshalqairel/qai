-- General client-facing charges. These are revenue-side booking records and
-- deliberately remain separate from business Expense records.

alter table public.booking_sessions
  add constraint booking_sessions_business_booking_id_key
  unique (business_id, booking_id, id);

create table public.additional_charge_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  normalized_name text generated always as (lower(btrim(name))) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, normalized_name)
);

create table public.booking_additional_charges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  session_id uuid,
  category_id uuid not null,
  category_name_snapshot text not null check (char_length(btrim(category_name_snapshot)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 240),
  amount numeric(14, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, booking_id)
    references public.bookings(business_id, id) on delete cascade,
  foreign key (business_id, category_id)
    references public.additional_charge_categories(business_id, id),
  foreign key (business_id, booking_id, session_id)
    references public.booking_sessions(business_id, booking_id, id) on delete cascade
);

create index booking_additional_charges_booking_idx
  on public.booking_additional_charges(business_id, booking_id);

create trigger set_additional_charge_categories_updated_at
  before update on public.additional_charge_categories
  for each row execute function public.set_updated_at();
create trigger set_booking_additional_charges_updated_at
  before update on public.booking_additional_charges
  for each row execute function public.set_updated_at();

alter table public.additional_charge_categories enable row level security;
alter table public.booking_additional_charges enable row level security;

create policy additional_charge_categories_member_access
  on public.additional_charge_categories for all to authenticated
  using ((select public.is_business_member(business_id)))
  with check ((select public.is_business_member(business_id)));
create policy booking_additional_charges_member_access
  on public.booking_additional_charges for all to authenticated
  using ((select public.is_business_member(business_id)))
  with check ((select public.is_business_member(business_id)));

grant select, insert, update, delete on table public.additional_charge_categories to authenticated;
grant select, insert, update, delete on table public.booking_additional_charges to authenticated;

comment on table public.booking_additional_charges is
  'Client-facing booking charges. Never mirror these automatically into expenses.';

-- Extend the existing atomic booking writer so schedules and client-facing
-- charges commit together. This replaces only the function definition; the
-- previously applied commercial migration remains unchanged.
create or replace function public.save_booking(booking_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_business_id uuid;
  target_booking_id uuid;
  existing_business_id uuid;
  existing_session_business_id uuid;
  existing_session_booking_id uuid;
  session_record jsonb;
  charge_record jsonb;
  retained_session_ids uuid[] := array[]::uuid[];
  retained_charge_ids uuid[] := array[]::uuid[];
  target_session_id uuid;
  target_charge_id uuid;
  target_category_id uuid;
  existing_charge_business_id uuid;
  existing_charge_booking_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(booking_payload) <> 'object'
    or jsonb_typeof(booking_payload->'sessions') <> 'array'
    or jsonb_array_length(booking_payload->'sessions') < 1
    or jsonb_array_length(booking_payload->'sessions') > 50
    or jsonb_typeof(coalesce(booking_payload->'additional_charges', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(booking_payload->'additional_charges', '[]'::jsonb)) > 100
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

  target_booking_id := (booking_payload->>'id')::uuid;
  select business_id into existing_business_id
  from public.bookings where id = target_booking_id;
  if existing_business_id is not null and existing_business_id <> target_business_id then
    raise exception 'Booking belongs to another business';
  end if;

  insert into public.bookings (
    id, business_id, customer_id, service_id, service_price, booking_status,
    full_payment_due_date, notes, created_at, updated_at
  ) values (
    target_booking_id,
    target_business_id,
    (booking_payload->>'customer_id')::uuid,
    (booking_payload->>'service_id')::uuid,
    (booking_payload->>'service_price')::numeric,
    booking_payload->>'booking_status',
    (booking_payload->>'full_payment_due_date')::date,
    coalesce(booking_payload->>'notes', ''),
    coalesce((booking_payload->>'created_at')::timestamptz, now()),
    coalesce((booking_payload->>'updated_at')::timestamptz, now())
  )
  on conflict (id) do update set
    customer_id = excluded.customer_id,
    service_id = excluded.service_id,
    service_price = excluded.service_price,
    booking_status = excluded.booking_status,
    full_payment_due_date = excluded.full_payment_due_date,
    notes = excluded.notes,
    updated_at = excluded.updated_at;

  for session_record in
    select value from jsonb_array_elements(booking_payload->'sessions')
  loop
    target_session_id := (session_record->>'id')::uuid;
    select business_id, booking_id
      into existing_session_business_id, existing_session_booking_id
    from public.booking_sessions
    where id = target_session_id;
    if existing_session_business_id is not null
      and (existing_session_business_id <> target_business_id or existing_session_booking_id <> target_booking_id)
    then
      raise exception 'Schedule session belongs to another booking';
    end if;

    insert into public.booking_sessions (
      id, business_id, booking_id, sequence, label, start_at, end_at,
      location, notes, created_at, updated_at
    ) values (
      target_session_id,
      target_business_id,
      target_booking_id,
      (session_record->>'sequence')::integer,
      coalesce(session_record->>'label', ''),
      (session_record->>'start_at')::timestamptz,
      (session_record->>'end_at')::timestamptz,
      coalesce(session_record->>'location', ''),
      coalesce(session_record->>'notes', ''),
      coalesce((session_record->>'created_at')::timestamptz, now()),
      coalesce((session_record->>'updated_at')::timestamptz, now())
    )
    on conflict (id) do update set
      sequence = excluded.sequence,
      label = excluded.label,
      start_at = excluded.start_at,
      end_at = excluded.end_at,
      location = excluded.location,
      notes = excluded.notes,
      updated_at = excluded.updated_at;

    retained_session_ids := array_append(retained_session_ids, target_session_id);
  end loop;

  delete from public.booking_sessions
  where business_id = target_business_id
    and booking_id = target_booking_id
    and not (id = any(retained_session_ids));

  for charge_record in
    select value from jsonb_array_elements(coalesce(booking_payload->'additional_charges', '[]'::jsonb))
  loop
    target_charge_id := (charge_record->>'id')::uuid;
    target_category_id := null;

    select business_id, booking_id
      into existing_charge_business_id, existing_charge_booking_id
    from public.booking_additional_charges
    where id = target_charge_id;
    if existing_charge_business_id is not null
      and (existing_charge_business_id <> target_business_id or existing_charge_booking_id <> target_booking_id)
    then
      raise exception 'Additional charge belongs to another booking';
    end if;

    select id into target_category_id
    from public.additional_charge_categories
    where business_id = target_business_id
      and id = (charge_record->>'category_id')::uuid;

    if target_category_id is null then
      select id into target_category_id
      from public.additional_charge_categories
      where business_id = target_business_id
        and normalized_name = lower(btrim(charge_record->>'category_name'));
    end if;

    if target_category_id is null then
      target_category_id := (charge_record->>'category_id')::uuid;
      insert into public.additional_charge_categories (id, business_id, name)
      values (target_category_id, target_business_id, btrim(charge_record->>'category_name'));
    end if;

    insert into public.booking_additional_charges (
      id, business_id, booking_id, session_id, category_id,
      category_name_snapshot, description, amount, created_at, updated_at
    ) values (
      target_charge_id,
      target_business_id,
      target_booking_id,
      nullif(charge_record->>'session_id', '')::uuid,
      target_category_id,
      btrim(charge_record->>'category_name'),
      coalesce(charge_record->>'description', ''),
      (charge_record->>'amount')::numeric,
      coalesce((charge_record->>'created_at')::timestamptz, now()),
      coalesce((charge_record->>'updated_at')::timestamptz, now())
    )
    on conflict (id) do update set
      session_id = excluded.session_id,
      category_id = excluded.category_id,
      category_name_snapshot = excluded.category_name_snapshot,
      description = excluded.description,
      amount = excluded.amount,
      updated_at = excluded.updated_at
    where booking_additional_charges.business_id = target_business_id
      and booking_additional_charges.booking_id = target_booking_id;

    retained_charge_ids := array_append(retained_charge_ids, target_charge_id);
  end loop;

  delete from public.booking_additional_charges
  where business_id = target_business_id
    and booking_id = target_booking_id
    and not (id = any(retained_charge_ids));

  return target_booking_id;
end;
$$;

revoke all on function public.save_booking(jsonb) from public;
grant execute on function public.save_booking(jsonb) to authenticated;
