-- Booking financial integrity: canonical payment limits and atomic initial
-- Payment persistence. This is forward-only because earlier migrations are
-- already present in the linked development database.

create or replace function public.validate_payment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_status text;
  target_total numeric(14, 2);
  paid_before_write numeric(14, 2);
begin
  select
    booking.booking_status,
    booking.service_price + coalesce((
      select sum(charge.amount)
      from public.booking_additional_charges charge
      where charge.business_id = booking.business_id
        and charge.booking_id = booking.id
    ), 0)
    into target_status, target_total
  from public.bookings booking
  where booking.business_id = new.business_id
    and booking.id = new.booking_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if target_status = 'Cancelled'
    and (tg_op = 'INSERT' or old.booking_id is distinct from new.booking_id)
  then
    raise exception 'New payments cannot be added to a cancelled booking';
  end if;

  select coalesce(sum(payment.amount), 0)
    into paid_before_write
  from public.payments payment
  where payment.business_id = new.business_id
    and payment.booking_id = new.booking_id
    and payment.id <> new.id;

  if paid_before_write + new.amount > target_total then
    raise exception 'Payment exceeds the booking outstanding amount';
  end if;

  return new;
end;
$$;

-- Normalize Additional Charge category identity in the same transaction as
-- Booking, schedule, questionnaire, and charge persistence. This definition is
-- intentionally repeated here so the recovery branch is safe whether or not
-- the linked database already received the earlier Qai Space integrity batch.
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
    select value
    from jsonb_array_elements(coalesce(booking_payload->'additional_charges', '[]'::jsonb))
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
      on conflict (business_id, normalized_name) do update
        set name = excluded.name
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

create or replace function public.save_booking_with_initial_payment(
  booking_payload jsonb,
  initial_payment_payload jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking_id uuid;
  target_business_id uuid;
  target_payment_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  target_booking_id := public.save_booking_with_integrity(booking_payload);
  if initial_payment_payload is null or initial_payment_payload = 'null'::jsonb then
    return target_booking_id;
  end if;

  if jsonb_typeof(initial_payment_payload) <> 'object'
    or coalesce(initial_payment_payload->>'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(initial_payment_payload->>'booking_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(initial_payment_payload->'amount') <> 'number'
    or (initial_payment_payload->>'amount')::numeric <= 0
    or coalesce(initial_payment_payload->>'payment_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(initial_payment_payload->>'method', '') not in ('Bank Transfer', 'Cash', 'QRIS', 'E-Wallet', 'Credit Card', 'Other')
    or char_length(coalesce(initial_payment_payload->>'notes', '')) > 2000
  then
    raise exception 'Invalid initial payment';
  end if;

  if (initial_payment_payload->>'booking_id')::uuid is distinct from target_booking_id then
    raise exception 'Initial payment booking mismatch';
  end if;

  select booking.business_id into target_business_id
  from public.bookings booking
  where booking.id = target_booking_id
    and (select public.is_business_member(booking.business_id))
  for update;
  if target_business_id is null then
    raise exception 'Booking belongs to another business';
  end if;

  target_payment_id := (initial_payment_payload->>'id')::uuid;
  insert into public.payments (
    id,
    business_id,
    booking_id,
    payment_date,
    amount,
    method,
    notes,
    created_at
  ) values (
    target_payment_id,
    target_business_id,
    target_booking_id,
    (initial_payment_payload->>'payment_date')::date,
    (initial_payment_payload->>'amount')::numeric,
    initial_payment_payload->>'method',
    coalesce(initial_payment_payload->>'notes', ''),
    coalesce(nullif(initial_payment_payload->>'created_at', '')::timestamptz, now())
  );

  return target_booking_id;
end;
$$;

revoke all on function public.save_booking_with_initial_payment(jsonb, jsonb) from public, anon;
grant execute on function public.save_booking_with_initial_payment(jsonb, jsonb) to authenticated;

comment on function public.save_booking_with_initial_payment(jsonb, jsonb) is
  'Atomically saves one Booking aggregate and an optional canonical initial Payment for the authenticated business.';
