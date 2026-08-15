-- Forward-compatible named tax/withholding model. Existing invoices remain
-- tax-disabled and retain their original totals.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.invoices'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%total%subtotal%discount%'
    and pg_get_constraintdef(oid) not ilike '%tax_amount%'
  limit 1;
  if constraint_name is not null then
    execute format('alter table public.invoices drop constraint %I', constraint_name);
  end if;
end;
$$;

alter table public.invoices
  add column if not exists tax_enabled boolean not null default false,
  add column if not exists tax_name text not null default 'Tax'
    check (char_length(btrim(tax_name)) between 1 and 40),
  add column if not exists tax_mode text not null default 'percentage'
    check (tax_mode in ('percentage', 'fixed')),
  add column if not exists tax_value numeric(14, 4) not null default 0
    check (tax_value >= 0),
  add column if not exists tax_treatment text not null default 'added'
    check (tax_treatment in ('added', 'deducted')),
  add column if not exists tax_amount numeric(14, 2) not null default 0
    check (tax_amount >= 0);

alter table public.invoices
  add constraint invoices_total_with_tax_check check (
    total = greatest(
      subtotal - discount +
      case when tax_enabled and tax_treatment = 'added' then tax_amount
           when tax_enabled and tax_treatment = 'deducted' then -tax_amount
           else 0 end,
      0
    )
  );
