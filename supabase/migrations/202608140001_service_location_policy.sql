-- Forward-only extension for service location choices.
-- Existing services remain compatible and default to the least restrictive manual choice.

alter table public.services
  add column if not exists location_policy text not null default 'Client can choose'
  check (location_policy in (
    'Business/studio only',
    'Client location only',
    'Client can choose',
    'Online'
  ));

comment on column public.services.location_policy is
  'Controls public service-location choices. Client addresses remain booking/request data.';
