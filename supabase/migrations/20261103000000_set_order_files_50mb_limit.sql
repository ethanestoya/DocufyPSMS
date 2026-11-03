-- Keep order-file uploads capped per object. The project-wide Storage limit
-- must also be set to at least 50 MiB in the Supabase Dashboard.
do $$
begin
  update storage.buckets
  set file_size_limit = 52428800
  where id = 'order-files';

  if not found then
    raise exception 'Storage bucket "order-files" does not exist';
  end if;
end;
$$;