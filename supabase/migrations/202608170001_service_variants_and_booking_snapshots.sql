-- Forward-only support for generic service options/variants and immutable
-- booking service-selection snapshots. Existing services and bookings remain
-- valid through empty JSON defaults.

alter table public.services
  add column option_groups jsonb not null default '[]'::jsonb,
  add column variants jsonb not null default '[]'::jsonb,
  add constraint services_option_groups_array_check
    check (
      jsonb_typeof(option_groups) = 'array'
      and jsonb_array_length(option_groups) <= 4
    ),
  add constraint services_variants_array_check
    check (
      jsonb_typeof(variants) = 'array'
      and jsonb_array_length(variants) <= 200
    );

alter table public.bookings
  add column service_snapshot jsonb not null default '{}'::jsonb,
  add constraint bookings_service_snapshot_object_check
    check (jsonb_typeof(service_snapshot) = 'object');

-- These indexes are intentionally non-unique. Different clients may share a
-- name or contact value; they only support ranked matching suggestions.
create index customers_business_normalized_phone_idx
  on public.customers (business_id, regexp_replace(phone, '[^0-9]', '', 'g'));

create index customers_business_normalized_email_idx
  on public.customers (business_id, lower(btrim(email)))
  where btrim(email) <> '';

create index customers_business_normalized_instagram_idx
  on public.customers (business_id, lower(trim(leading '@' from btrim(instagram))))
  where btrim(instagram) <> '';

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

  target_booking_id := public.save_booking(booking_payload);

  update public.bookings booking
  set questionnaire_responses = responses,
      service_snapshot = selection_snapshot
  where booking.id = target_booking_id
    and (select public.is_business_member(booking.business_id));

  if not found then
    raise exception 'Booking belongs to another business';
  end if;

  return target_booking_id;
end;
$$;

revoke all on function public.save_booking_with_questionnaire(jsonb) from public;
grant execute on function public.save_booking_with_questionnaire(jsonb) to authenticated;

comment on column public.services.option_groups is
  'Presentation-neutral service option groups. Empty for ordinary services.';
comment on column public.services.variants is
  'Explicit valid option combinations with price, duration, and schedule defaults.';
comment on column public.bookings.service_snapshot is
  'Immutable service/variant labels and values captured when a booking is saved.';
