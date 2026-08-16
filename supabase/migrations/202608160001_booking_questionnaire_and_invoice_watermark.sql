-- Shared configurable booking questions and private validation media extensions.
-- Existing booking writes remain backward compatible; the new wrapper keeps the
-- questionnaire snapshot in the same transaction as schedules and charges.

alter table public.bookings
  add column questionnaire_responses jsonb not null default '[]'::jsonb,
  add constraint bookings_questionnaire_responses_array_check
    check (jsonb_typeof(questionnaire_responses) = 'array'
      and jsonb_array_length(questionnaire_responses) <= 50);

create table public.booking_questionnaires (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  definition jsonb not null default '{}'::jsonb
    check (jsonb_typeof(definition) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_booking_questionnaires_updated_at
  before update on public.booking_questionnaires
  for each row execute function public.set_updated_at();

alter table public.booking_questionnaires enable row level security;

create policy booking_questionnaires_member_access
  on public.booking_questionnaires for all to authenticated
  using ((select public.is_business_member(business_id)))
  with check ((select public.is_business_member(business_id)));

grant select, insert, update, delete
  on table public.booking_questionnaires
  to authenticated;

create or replace function public.save_booking_with_questionnaire(booking_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_booking_id uuid;
  responses jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  responses := coalesce(booking_payload->'questionnaire_responses', '[]'::jsonb);
  if jsonb_typeof(responses) <> 'array' or jsonb_array_length(responses) > 50 then
    raise exception 'Invalid questionnaire responses';
  end if;

  target_booking_id := public.save_booking(booking_payload);

  update public.bookings booking
  set questionnaire_responses = responses
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

-- The validation-media bucket remains private. These kinds are written only by
-- the current server routes and read through the authenticated media endpoint.
alter table public.validation_media_assets
  drop constraint if exists validation_media_assets_kind_check,
  drop constraint if exists validation_media_assets_mime_type_check;

alter table public.validation_media_assets
  add constraint validation_media_assets_kind_check
    check (kind in (
      'page-logo', 'page-cover', 'portfolio', 'invoice-logo',
      'invoice-signature', 'invoice-stamp', 'invoice-watermark',
      'booking-response'
    )),
  add constraint validation_media_assets_mime_type_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  add constraint validation_media_assets_kind_mime_check
    check (mime_type <> 'application/pdf' or kind = 'booking-response');

comment on table public.booking_questionnaires is
  'Business-scoped booking questionnaire definition shared by copy, paste, Qai Page, and booking review flows.';
comment on column public.bookings.questionnaire_responses is
  'Private response snapshots; never client-facing invoice or public-page content.';

-- No grants are added for anon/public. Existing service_role media-table access
-- remains sufficient, and no storage.objects or storage.buckets grants change.
