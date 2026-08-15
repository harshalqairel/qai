-- This project was created with automatic Data API grants disabled.
-- Grant only the normalized tables and operations used by the authenticated
-- browser repositories. RLS remains the tenant-isolation boundary.

grant select, update
  on table public.businesses
  to authenticated;

grant select
  on table public.business_memberships
  to authenticated;

grant select, insert, update, delete
  on table public.service_categories,
           public.expense_categories,
           public.customers,
           public.services,
           public.payments,
           public.expenses
  to authenticated;

grant select, delete
  on table public.bookings
  to authenticated;

grant select
  on table public.booking_sessions
  to authenticated;

-- Booking and BookingSession writes remain atomic through save_booking(jsonb).
-- Additional Charge grants are defined by 202608140002.
-- No privileges are granted to anon or public.
