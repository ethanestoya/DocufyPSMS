-- One-time Supabase setup for the purge-expired-orders Edge Function.
-- Deploy the function and add its secrets before scheduling it; see
-- functions/purge-expired-orders/README.md.
-- Ensure the Supabase Vault extension is enabled before running this script.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Keep the retention clock accurate for status changes made by any client or
-- server process, including older app versions.
create or replace function public.set_order_status_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_status_updated_at on public.orders;
create trigger orders_set_status_updated_at
before update of status on public.orders
for each row
execute function public.set_order_status_updated_at();

-- Give terminal orders that already exist a full retention window after
-- installation; their historical status-change timestamps may predate this
-- cleanup feature or may not have been maintained by older clients.
update public.orders
set status_updated_at = now()
where status in ('Canceled', 'Released');

-- Run these two statements once, replacing the placeholders. Generate a long,
-- random cron secret and use the exact same value with:
--   supabase secrets set ORDER_RETENTION_CRON_SECRET=<secret>
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'docufy_order_retention_project_url',
  'Supabase project URL for scheduled order retention'
);

select vault.create_secret(
  'REPLACE_WITH_THE_RANDOM_ORDER_RETENTION_CRON_SECRET',
  'docufy_order_retention_cron_secret',
  'Shared secret for the scheduled order retention function'
);

-- Daily at 18:00 UTC (02:00 Philippine time). Re-running replaces the job.
select cron.unschedule(jobid)
from cron.job
where jobname = 'docufy-order-retention-daily';

select cron.schedule(
  'docufy-order-retention-daily',
  '0 18 * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'docufy_order_retention_project_url'
      ) || '/functions/v1/purge-expired-orders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-order-retention-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'docufy_order_retention_cron_secret'
        )
      ),
      body := '{"trigger":"pg_cron"}'::jsonb
    );
  $job$
);
