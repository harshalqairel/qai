-- A public Qai Page request represents one reservation. Retried conversion on
-- the cloud repository must return the existing Booking, never create another.
create unique index if not exists bookings_business_capacity_source_request_unique
  on public.bookings (business_id, capacity_source_request_id)
  where capacity_source_request_id is not null;
