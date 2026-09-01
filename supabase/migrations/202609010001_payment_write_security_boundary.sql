-- Preserve authenticated Payment writes without granting broad Booking write
-- access. The trigger needs a privileged, narrowly scoped boundary because
-- PostgreSQL requires UPDATE privilege for SELECT ... FOR UPDATE.

create or replace function public.validate_payment_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_status text;
  target_total numeric(14, 2);
  paid_before_write numeric(14, 2);
begin
  if (select auth.uid()) is null
    or not (select public.is_business_member(new.business_id))
  then
    raise exception 'Business membership required';
  end if;

  if new.amount is null or new.amount <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;

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

-- Trigger functions are invoked by PostgreSQL, not called directly by clients.
revoke all on function public.validate_payment_write() from public, anon, authenticated;

comment on function public.validate_payment_write() is
  'Tenant-checked Payment guard that serializes writes per Booking and prevents overpayment.';
