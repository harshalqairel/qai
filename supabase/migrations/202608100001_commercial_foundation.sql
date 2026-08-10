-- Qai commercial cloud foundation.
-- Apply through the Supabase CLI so this migration is versioned and repeatable.

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  display_name text,
  logo_path text,
  email text,
  whatsapp_number text,
  instagram text,
  address text,
  currency text not null default 'IDR' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Jakarta',
  invoice_prefix text not null default 'INV' check (char_length(btrim(invoice_prefix)) between 1 and 12),
  payment_instructions text not null default '',
  default_payment_terms text not null default '',
  default_terms_and_conditions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = target_business_id
      and membership.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_business_role(
  target_business_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_memberships membership
    where membership.business_id = target_business_id
      and membership.user_id = (select auth.uid())
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
revoke all on function public.has_business_role(uuid, text[]) from public;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.has_business_role(uuid, text[]) to authenticated;

create or replace function public.create_business(display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_business_id uuid;
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if display_name is null or char_length(btrim(display_name)) not between 1 and 120 then
    raise exception 'Business name must contain between 1 and 120 characters';
  end if;

  insert into public.businesses (name)
  values (btrim(display_name))
  returning id into new_business_id;

  insert into public.business_memberships (business_id, user_id, role)
  values (new_business_id, current_user_id, 'owner');

  insert into public.reminder_settings (business_id)
  values (new_business_id);

  insert into public.subscriptions (business_id, plan_key, status)
  values (new_business_id, 'free', 'active');

  return new_business_id;
end;
$$;

revoke all on function public.create_business(text) from public;
grant execute on function public.create_business(text) to authenticated;

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  normalized_name text generated always as (lower(btrim(name))) stored,
  color text not null default '#0D5C5A',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, normalized_name)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  normalized_name text generated always as (lower(btrim(name))) stored,
  color text not null default '#64748B',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, normalized_name)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text not null default '',
  instagram text not null default '',
  email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  price numeric(14, 2) not null default 0 check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, category_id)
    references public.service_categories(business_id, id)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null,
  service_id uuid not null,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Asia/Jakarta',
  location text not null default '',
  service_price numeric(14, 2) not null check (service_price >= 0),
  booking_status text not null default 'Scheduled'
    check (booking_status in ('Scheduled', 'Completed', 'Cancelled')),
  full_payment_due_date date not null,
  payment_reminders_enabled boolean not null default true,
  notes text not null default '',
  auto_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, customer_id)
    references public.customers(business_id, id),
  foreign key (business_id, service_id)
    references public.services(business_id, id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  payment_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  method text not null
    check (method in ('Bank Transfer', 'Cash', 'QRIS', 'E-Wallet', 'Credit Card', 'Other')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, booking_id)
    references public.bookings(business_id, id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null,
  booking_id uuid,
  expense_date date not null,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method text not null
    check (payment_method in ('Bank Transfer', 'Cash', 'QRIS', 'E-Wallet', 'Credit Card', 'Other')),
  expense_type text not null
    check (expense_type in ('Booking Expense', 'Business Expense')),
  vendor text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, category_id)
    references public.expense_categories(business_id, id),
  foreign key (business_id, booking_id)
    references public.bookings(business_id, id),
  check (
    (expense_type = 'Booking Expense' and booking_id is not null)
    or (expense_type = 'Business Expense' and booking_id is null)
  )
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid,
  invoice_number text not null,
  issued_at timestamptz not null default now(),
  due_date date not null,
  business_snapshot jsonb not null,
  customer_snapshot jsonb not null,
  booking_snapshot jsonb,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(14, 2) not null check (subtotal >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null check (total >= 0),
  payment_instructions text not null default '',
  terms_and_conditions text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, invoice_number),
  foreign key (business_id, booking_id)
    references public.bookings(business_id, id),
  check (discount <= subtotal),
  check (total = subtotal - discount)
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  invoice_id uuid not null,
  position integer not null check (position >= 0),
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now(),
  unique (business_id, invoice_id, position),
  foreign key (business_id, invoice_id)
    references public.invoices(business_id, id) on delete cascade
);

create table public.reminder_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  enabled boolean not null default true,
  offsets_days integer[] not null default array[7, 3, 1, 0, -3],
  whatsapp_template text not null default '',
  in_app_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reminder_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  booking_id uuid not null,
  method text not null check (method in ('WhatsApp', 'In App', 'Email')),
  remaining_amount_snapshot numeric(14, 2) not null check (remaining_amount_snapshot >= 0),
  reminder_rule_days integer,
  reminded_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  foreign key (business_id, booking_id)
    references public.bookings(business_id, id)
);

create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null check (provider in ('google_calendar')),
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'error')),
  external_account_id text,
  destination_id text,
  credential_secret_id uuid,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, provider)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references public.businesses(id) on delete cascade,
  plan_key text not null default 'free' check (plan_key in ('free', 'solo', 'pro')),
  billing_interval text check (billing_interval in ('month', 'year')),
  provider text check (provider in ('xendit')),
  provider_customer_id text,
  provider_subscription_id text unique,
  status text not null default 'active'
    check (status in ('active', 'trialing', 'past_due', 'cancel_at_period_end', 'cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('xendit')),
  provider_event_id text not null,
  business_id uuid references public.businesses(id) on delete set null,
  payload_hash text not null,
  event_type text not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.data_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  source text not null default 'local_storage' check (source = 'local_storage'),
  fingerprint text not null,
  record_counts jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'failed')),
  error_code text,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (business_id, fingerprint)
);

create index business_memberships_user_id_idx
  on public.business_memberships(user_id, business_id);
create index customers_business_name_idx on public.customers(business_id, name);
create index services_business_active_idx on public.services(business_id, active);
create index bookings_business_date_idx on public.bookings(business_id, booking_date, start_time);
create index bookings_business_status_idx on public.bookings(business_id, booking_status);
create index bookings_business_due_idx on public.bookings(business_id, full_payment_due_date);
create index payments_business_booking_idx on public.payments(business_id, booking_id, payment_date);
create index payments_business_date_idx on public.payments(business_id, payment_date);
create index expenses_business_date_idx on public.expenses(business_id, expense_date);
create index expenses_business_booking_idx on public.expenses(business_id, booking_id);
create index reminder_history_booking_idx on public.reminder_history(business_id, booking_id, reminded_at desc);

create or replace function public.validate_payment_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_status text;
  target_price numeric(14, 2);
  paid_before_write numeric(14, 2);
begin
  select booking_status, service_price
    into target_status, target_price
  from public.bookings
  where business_id = new.business_id and id = new.booking_id
  for update;

  if not found then
    raise exception 'Booking not found';
  end if;

  if target_status = 'Cancelled'
    and (tg_op = 'INSERT' or old.booking_id is distinct from new.booking_id)
  then
    raise exception 'New payments cannot be added to a cancelled booking';
  end if;

  select coalesce(sum(amount), 0)
    into paid_before_write
  from public.payments
  where business_id = new.business_id
    and booking_id = new.booking_id
    and id <> new.id;

  if paid_before_write + new.amount > target_price then
    raise exception 'Payment exceeds the booking outstanding amount';
  end if;

  return new;
end;
$$;

create trigger validate_payment_before_write
before insert or update on public.payments
for each row execute function public.validate_payment_write();

create or replace function public.validate_expense_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_status text;
begin
  if new.booking_id is null then return new; end if;

  select booking_status
    into target_status
  from public.bookings
  where business_id = new.business_id and id = new.booking_id;

  if not found then
    raise exception 'Booking not found';
  end if;

  if target_status = 'Cancelled'
    and (tg_op = 'INSERT' or old.booking_id is distinct from new.booking_id)
  then
    raise exception 'New expenses cannot be linked to a cancelled booking';
  end if;

  return new;
end;
$$;

create trigger validate_expense_before_write
before insert or update on public.expenses
for each row execute function public.validate_expense_write();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'businesses', 'service_categories', 'expense_categories', 'customers',
    'services', 'bookings', 'payments', 'expenses', 'invoices',
    'reminder_settings', 'integrations', 'subscriptions'
  ]
  loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.service_categories enable row level security;
alter table public.expense_categories enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.reminder_settings enable row level security;
alter table public.reminder_history enable row level security;
alter table public.integrations enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.data_imports enable row level security;

create policy businesses_select_members on public.businesses
  for select to authenticated
  using ((select public.is_business_member(id)));
create policy businesses_update_admins on public.businesses
  for update to authenticated
  using ((select public.has_business_role(id, array['owner', 'admin'])))
  with check ((select public.has_business_role(id, array['owner', 'admin'])));
create policy businesses_delete_owners on public.businesses
  for delete to authenticated
  using ((select public.has_business_role(id, array['owner'])));

create policy memberships_select_members on public.business_memberships
  for select to authenticated
  using ((select public.is_business_member(business_id)));
create policy memberships_insert_owners on public.business_memberships
  for insert to authenticated
  with check ((select public.has_business_role(business_id, array['owner'])));
create policy memberships_update_owners on public.business_memberships
  for update to authenticated
  using ((select public.has_business_role(business_id, array['owner'])))
  with check ((select public.has_business_role(business_id, array['owner'])));
create policy memberships_delete_owners on public.business_memberships
  for delete to authenticated
  using ((select public.has_business_role(business_id, array['owner'])));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'service_categories', 'expense_categories', 'customers', 'services',
    'bookings', 'payments', 'expenses', 'invoices', 'invoice_items',
    'reminder_settings', 'reminder_history'
  ]
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select public.is_business_member(business_id))) with check ((select public.is_business_member(business_id)))',
      table_name || '_member_access',
      table_name
    );
  end loop;
end;
$$;

create policy integrations_select_members on public.integrations
  for select to authenticated
  using ((select public.is_business_member(business_id)));
create policy integrations_manage_admins on public.integrations
  for all to authenticated
  using ((select public.has_business_role(business_id, array['owner', 'admin'])))
  with check ((select public.has_business_role(business_id, array['owner', 'admin'])));

create policy subscriptions_select_members on public.subscriptions
  for select to authenticated
  using ((select public.is_business_member(business_id)));

-- billing_events deliberately has no authenticated policies. Only privileged,
-- verified webhook code may read or mutate it.

create policy data_imports_select_members on public.data_imports
  for select to authenticated
  using ((select public.is_business_member(business_id)));

create or replace function public.import_local_data(
  import_payload jsonb,
  import_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_business_id uuid;
  import_id uuid;
  existing_status text;
  source_record jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if import_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid import fingerprint';
  end if;

  select membership.business_id
    into target_business_id
  from public.business_memberships membership
  where membership.user_id = (select auth.uid())
  order by membership.created_at
  limit 1;

  if target_business_id is null then
    raise exception 'Business membership required';
  end if;

  if jsonb_typeof(import_payload) <> 'object'
    or jsonb_typeof(import_payload->'serviceCategories') <> 'array'
    or jsonb_typeof(import_payload->'expenseCategories') <> 'array'
    or jsonb_typeof(import_payload->'customers') <> 'array'
    or jsonb_typeof(import_payload->'services') <> 'array'
    or jsonb_typeof(import_payload->'bookings') <> 'array'
    or jsonb_typeof(import_payload->'payments') <> 'array'
    or jsonb_typeof(import_payload->'expenses') <> 'array'
  then
    raise exception 'Incomplete import payload';
  end if;

  select id, status into import_id, existing_status
  from public.data_imports
  where business_id = target_business_id and fingerprint = import_fingerprint;

  if existing_status = 'completed' then
    return jsonb_build_object('status', 'already_imported', 'importId', import_id);
  end if;

  if import_id is null then
    insert into public.data_imports (
      business_id,
      fingerprint,
      record_counts,
      status
    ) values (
      target_business_id,
      import_fingerprint,
      jsonb_build_object(
        'serviceCategories', jsonb_array_length(import_payload->'serviceCategories'),
        'expenseCategories', jsonb_array_length(import_payload->'expenseCategories'),
        'customers', jsonb_array_length(import_payload->'customers'),
        'services', jsonb_array_length(import_payload->'services'),
        'bookings', jsonb_array_length(import_payload->'bookings'),
        'payments', jsonb_array_length(import_payload->'payments'),
        'expenses', jsonb_array_length(import_payload->'expenses')
      ),
      'pending'
    ) returning id into import_id;
  else
    update public.data_imports
      set status = 'pending', error_code = null, completed_at = null
    where id = import_id;
  end if;

  begin
    for source_record in select value from jsonb_array_elements(import_payload->'serviceCategories')
    loop
      insert into public.service_categories (
        id, business_id, name, color, active, created_at, updated_at
      ) values (
        (source_record->>'id')::uuid,
        target_business_id,
        source_record->>'name',
        coalesce(nullif(source_record->>'color', ''), '#0D5C5A'),
        coalesce((source_record->>'active')::boolean, true),
        coalesce((nullif(source_record->>'createdAt', ''))::timestamptz, now()),
        coalesce((nullif(source_record->>'updatedAt', ''))::timestamptz, now())
      ) on conflict (id) do nothing;
    end loop;

    for source_record in select value from jsonb_array_elements(import_payload->'expenseCategories')
    loop
      insert into public.expense_categories (
        id, business_id, name, color, active, created_at, updated_at
      ) values (
        (source_record->>'id')::uuid,
        target_business_id,
        source_record->>'name',
        coalesce(nullif(source_record->>'color', ''), '#64748B'),
        coalesce((source_record->>'active')::boolean, true),
        coalesce((nullif(source_record->>'createdAt', ''))::timestamptz, now()),
        coalesce((nullif(source_record->>'updatedAt', ''))::timestamptz, now())
      ) on conflict (id) do nothing;
    end loop;

    for source_record in select value from jsonb_array_elements(import_payload->'customers')
    loop
      insert into public.customers (
        id, business_id, name, phone, instagram, email, notes, created_at
      ) values (
        (source_record->>'id')::uuid,
        target_business_id,
        source_record->>'name',
        coalesce(source_record->>'phone', ''),
        coalesce(source_record->>'instagram', ''),
        coalesce(source_record->>'email', ''),
        coalesce(source_record->>'notes', ''),
        to_timestamp(coalesce((source_record->>'createdAt')::double precision, 0) / 1000.0)
      ) on conflict (id) do nothing;
    end loop;

    for source_record in select value from jsonb_array_elements(import_payload->'services')
    loop
      insert into public.services (
        id, business_id, category_id, name, price, duration_minutes,
        description, active
      ) values (
        (source_record->>'id')::uuid,
        target_business_id,
        (source_record->>'categoryId')::uuid,
        source_record->>'name',
        (source_record->>'price')::numeric,
        (source_record->>'duration')::integer,
        coalesce(source_record->>'description', ''),
        coalesce((source_record->>'active')::boolean, true)
      ) on conflict (id) do nothing;
    end loop;

    for source_record in select value from jsonb_array_elements(import_payload->'bookings')
    loop
      insert into public.bookings (
        id, business_id, customer_id, service_id, booking_date, start_time,
        end_time, location, service_price, booking_status,
        full_payment_due_date, notes, created_at, updated_at
      ) values (
        (source_record->>'id')::uuid,
        target_business_id,
        (source_record->>'customerId')::uuid,
        (source_record->>'serviceId')::uuid,
        (source_record->>'bookingDate')::date,
        (source_record->>'startTime')::time,
        (source_record->>'endTime')::time,
        coalesce(source_record->>'location', ''),
        (source_record->>'servicePrice')::numeric,
        source_record->>'bookingStatus',
        (source_record->>'fullPaymentDueDate')::date,
        coalesce(source_record->>'notes', ''),
        to_timestamp((source_record->>'createdAt')::double precision / 1000.0),
        to_timestamp((source_record->>'updatedAt')::double precision / 1000.0)
      ) on conflict (id) do nothing;
    end loop;

    for source_record in select value from jsonb_array_elements(import_payload->'payments')
    loop
      insert into public.payments (
        id, business_id, booking_id, payment_date, amount, method, notes, created_at
      ) values (
        (source_record->>'id')::uuid,
        target_business_id,
        (source_record->>'bookingId')::uuid,
        (source_record->>'date')::date,
        (source_record->>'amount')::numeric,
        case source_record->>'method'
          when 'Transfer' then 'Bank Transfer'
          else source_record->>'method'
        end,
        coalesce(source_record->>'notes', ''),
        to_timestamp((source_record->>'createdAt')::double precision / 1000.0)
      ) on conflict (id) do nothing;
    end loop;

    for source_record in select value from jsonb_array_elements(import_payload->'expenses')
    loop
      insert into public.expenses (
        id, business_id, category_id, booking_id, expense_date, amount,
        payment_method, expense_type, vendor, notes, created_at, updated_at
      ) values (
        (source_record->>'id')::uuid,
        target_business_id,
        (source_record->>'categoryId')::uuid,
        case when source_record->>'bookingId' is null then null
          else (source_record->>'bookingId')::uuid end,
        (source_record->>'date')::date,
        (source_record->>'amount')::numeric,
        case source_record->>'paymentMethod'
          when 'Transfer' then 'Bank Transfer'
          else source_record->>'paymentMethod'
        end,
        source_record->>'expenseType',
        coalesce(source_record->>'vendor', ''),
        coalesce(source_record->>'notes', ''),
        to_timestamp((source_record->>'createdAt')::double precision / 1000.0),
        to_timestamp((source_record->>'updatedAt')::double precision / 1000.0)
      ) on conflict (id) do nothing;
    end loop;

    update public.data_imports
      set status = 'completed', completed_at = now(), error_code = null
    where id = import_id;

    return jsonb_build_object('status', 'completed', 'importId', import_id);
  exception when others then
    update public.data_imports
      set status = 'failed', error_code = sqlstate
    where id = import_id;
    return jsonb_build_object('status', 'failed', 'importId', import_id, 'errorCode', sqlstate);
  end;
end;
$$;

revoke all on function public.import_local_data(jsonb, text) from public;
grant execute on function public.import_local_data(jsonb, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-logos',
  'business-logos',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy business_logos_insert_members on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-logos'
    and (select public.is_business_member(((storage.foldername(name))[1])::uuid))
  );

create policy business_logos_update_members on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-logos'
    and (select public.is_business_member(((storage.foldername(name))[1])::uuid))
  )
  with check (
    bucket_id = 'business-logos'
    and (select public.is_business_member(((storage.foldername(name))[1])::uuid))
  );

create policy business_logos_delete_admins on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-logos'
    and (select public.has_business_role(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin']
    ))
  );

create or replace function public.auto_complete_bookings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed_count integer;
begin
  update public.bookings
  set
    booking_status = 'Completed',
    auto_completed_at = now(),
    updated_at = now()
  where booking_status = 'Scheduled'
    and (
      case
        when end_time <= start_time then
          ((booking_date + 1) + end_time) at time zone timezone
        else
          (booking_date + end_time) at time zone timezone
      end
    ) < now();

  get diagnostics completed_count = row_count;
  return completed_count;
end;
$$;

revoke all on function public.auto_complete_bookings() from public;

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'qai-auto-complete-bookings',
  '*/15 * * * *',
  'select public.auto_complete_bookings();'
);
