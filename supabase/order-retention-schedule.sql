-- Run after applying the immediate-retention migration and deploying the
-- purge-expired-orders Edge Function. This reuses the Vault values created by
-- the original schedule; do not recreate or rotate them here.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'docufy-order-retention-daily',
  'docufy-order-retention-immediate'
);

select cron.schedule(
  'docufy-order-retention-immediate',
  '* * * * *',
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
