-- Explicit backend grants for remote validation projects created without
-- automatic Data API privileges. Browser roles remain intentionally revoked;
-- all validation access continues through Qai server routes.

grant select, insert, update, delete
on table public.validation_workspaces
to service_role;

grant select, insert, update
on table public.validation_invites
to service_role;

grant select, insert, update
on table public.validation_sessions
to service_role;

grant select, insert, update, delete
on table public.validation_workspace_documents
to service_role;

grant select, insert, update, delete
on table public.validation_public_pages
to service_role;

grant select, insert, update, delete
on table public.validation_public_requests
to service_role;

grant select, insert, delete
on table public.validation_media_assets
to service_role;

grant select, delete
on table public.validation_invoice_sequences
to service_role;

grant select, delete
on table public.validation_import_operations
to service_role;

grant select, insert, update, delete
on table public.validation_calendar_connections
to service_role;

grant select, insert, update, delete
on table public.validation_google_oauth_states
to service_role;

grant select, insert, update, delete
on table public.validation_calendar_event_links
to service_role;

grant execute
on function public.allocate_validation_invoice_number(uuid, text, integer, integer, integer)
to service_role;

grant execute
on function public.exchange_validation_invite(text, timestamptz)
to service_role;

grant execute
on function public.reserve_validation_instant_request(uuid, text, text, uuid, jsonb, jsonb, text)
to service_role;

-- No sequence grants are required: validation identifiers use gen_random_uuid()
-- and no validation table declares serial/identity columns.
-- Storage API privileges are managed by Supabase's storage schema. This
-- migration does not grant access to shared storage.objects/storage.buckets;
-- the private validation-media bucket and server-only delivery path are unchanged.
-- Future validation migrations must explicitly grant service_role only the
-- operations required by newly introduced server-side objects.
