-- Enforce the remaining upload limits at the Storage/database layer.
-- The global Storage limit must be at least 50 MiB for order-files.
do $$
declare
  missing_buckets text[];
begin
  update storage.buckets
  set file_size_limit = case id
    when 'profile-images' then 2097152
    when 'brand-assets' then 3145728
    when 'job-applications' then 10485760
  end
  where id in ('profile-images', 'brand-assets', 'job-applications');

  select array_agg(required.id order by required.id)
  into missing_buckets
  from (values ('profile-images'), ('brand-assets'), ('job-applications')) as required(id)
  left join storage.buckets bucket on bucket.id = required.id
  where bucket.id is null;

  if missing_buckets is not null then
    raise exception 'Required Storage buckets are missing: %', array_to_string(missing_buckets, ', ');
  end if;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-application-photos',
  'job-application-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "job application photos read own or staff admin" on storage.objects;
create policy "job application photos read own or staff admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'job-application-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_staff_or_admin()
  )
);

drop policy if exists "job application photos upload own" on storage.objects;
create policy "job application photos upload own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'job-application-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "job application photos update own" on storage.objects;
create policy "job application photos update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'job-application-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'job-application-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "job application photos delete own or staff admin" on storage.objects;
create policy "job application photos delete own or staff admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'job-application-photos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_staff_or_admin()
  )
);

alter table public.job_applications
  add column if not exists photo_storage_path text;

create or replace function public.enforce_job_application_photo_size()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  object_bucket text := 'job-applications';
  object_path text := new.photo_storage_path;
  object_size text;
begin
  if new.photo_storage_path is null then
    return new;
  end if;

  if new.photo_storage_path like 'job-application-photos:%' then
    object_bucket := 'job-application-photos';
    object_path := substr(
      new.photo_storage_path,
      length('job-application-photos:') + 1
    );
  end if;

  select object_row.metadata ->> 'size'
  into object_size
  from storage.objects as object_row
  where object_row.bucket_id = object_bucket
    and object_row.name = object_path;

  if not found or object_size !~ '^[0-9]+$' then
    raise exception 'Applicant photo is missing valid Storage size metadata';
  end if;

  if object_size::bigint > 5242880 then
    raise exception 'Applicant photo exceeds the 5 MiB size limit';
  end if;

  return new;
end;
$$;

drop trigger if exists job_applications_photo_size_limit on public.job_applications;
create trigger job_applications_photo_size_limit
before insert or update of photo_storage_path on public.job_applications
for each row
execute function public.enforce_job_application_photo_size();

create or replace function public.enforce_landing_auth_background_size()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  background_url text := new.content ->> 'authBackgroundUrl';
  encoded_image text;
begin
  if background_url like 'data:image/%' then
    if background_url !~ '^data:image/[^,]*;base64,' then
      raise exception 'Landing-page background must be a base64-encoded image';
    end if;

    encoded_image := split_part(background_url, ',', 2);
    if octet_length(decode(encoded_image, 'base64')) > 3145728 then
      raise exception 'Landing-page background exceeds the 3 MiB size limit';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists landing_content_auth_background_size_limit on public.landing_content;
create trigger landing_content_auth_background_size_limit
before insert or update of content on public.landing_content
for each row
execute function public.enforce_landing_auth_background_size();