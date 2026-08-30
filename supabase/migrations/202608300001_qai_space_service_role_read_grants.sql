-- Public Qai Space reads stay behind server routes. The service-role client
-- needs only these operational projections to materialize published Services
-- and calculate capacity from active Bookings and their sessions.
grant select
on table public.services,
         public.bookings,
         public.booking_sessions
to service_role;

-- Do not grant operational tables or Qai Space RPCs to anon. Existing RLS and
-- authenticated member policies remain unchanged.
