-- Permit questionnaire PDF answers without changing validation-media privacy or size limits.
do $$
begin
  update storage.buckets
  set allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
  where id = 'validation-media';

  if not found then
    raise exception 'validation-media bucket does not exist';
  end if;
end;
$$;
