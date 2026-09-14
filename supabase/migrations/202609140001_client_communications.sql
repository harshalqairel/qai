-- Durable, truthful records of client communication actions initiated by an
-- authenticated Qai business member. This table deliberately does not model
-- provider delivery: launch channels only prove that WhatsApp or an email
-- draft was opened.

create table public.client_communications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  booking_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  channel text not null check (channel in ('whatsapp', 'email')),
  template_type text not null check (template_type in (
    'blank',
    'booking_confirmation',
    'appointment_reminder',
    'payment_reminder',
    'overdue_reminder',
    'payment_received',
    'thank_you_follow_up'
  )),
  action_status text not null check (action_status in ('whatsapp_opened', 'email_draft_opened')),
  recipient_snapshot text not null check (char_length(btrim(recipient_snapshot)) between 1 and 320),
  subject text check (subject is null or char_length(subject) <= 200),
  body_snapshot text not null check (char_length(body_snapshot) between 1 and 4000),
  provider_reference text check (provider_reference is null or char_length(provider_reference) <= 500),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  unique (business_id, id),
  foreign key (business_id, customer_id)
    references public.customers(business_id, id) on delete cascade,
  foreign key (business_id, booking_id)
    references public.bookings(business_id, id) on delete set null (booking_id),
  check (
    (channel = 'whatsapp' and action_status = 'whatsapp_opened' and subject is null)
    or (channel = 'email' and action_status = 'email_draft_opened')
  )
);

create index client_communications_business_created_idx
  on public.client_communications(business_id, created_at desc);
create index client_communications_customer_created_idx
  on public.client_communications(business_id, customer_id, created_at desc);
create index client_communications_booking_created_idx
  on public.client_communications(business_id, booking_id, created_at desc)
  where booking_id is not null;

alter table public.client_communications enable row level security;

create policy client_communications_select_members
  on public.client_communications
  for select
  to authenticated
  using ((select public.is_business_member(business_id)));

create policy client_communications_insert_members
  on public.client_communications
  for insert
  to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and (select public.is_business_member(business_id))
    and exists (
      select 1
      from public.customers customer
      where customer.business_id = client_communications.business_id
        and customer.id = client_communications.customer_id
    )
    and (
      booking_id is null
      or exists (
        select 1
        from public.bookings booking
        where booking.business_id = client_communications.business_id
          and booking.id = client_communications.booking_id
          and booking.customer_id = client_communications.customer_id
      )
    )
  );

revoke all on table public.client_communications from public;
revoke all on table public.client_communications from anon;
revoke all on table public.client_communications from authenticated;
grant select, insert on table public.client_communications to authenticated;
