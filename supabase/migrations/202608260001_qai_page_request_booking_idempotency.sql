-- A public Qai Page request represents one reservation. Retried conversion on
-- the cloud repository must return the existing Booking, never create another.
create unique index if not exists bookings_business_capacity_source_request_unique
  on public.bookings (business_id, capacity_source_request_id)
  where capacity_source_request_id is not null;

-- Validation server capability discovery is deliberately read-only. Creating
-- it after both migrations lets the owner UI fail before opening a managed
-- scheduling flow when the connected database is behind the application.
create or replace function public.validation_backend_capabilities()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'supportsManagedAvailability', true,
    'supportsRequestBookingIdempotency', true
  );
$$;

revoke all on function public.validation_backend_capabilities() from public, anon, authenticated;
grant execute on function public.validation_backend_capabilities() to service_role;
