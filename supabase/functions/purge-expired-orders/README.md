# Scheduled order retention

The function permanently removes Supabase orders that have been `Released` or
`Canceled` for at least seven days. It does not purge `Completed` orders until
they are released, or any order that is still in progress.

It deletes order file objects from `order-files` and payment proof objects from
`payment-proofs`, then removes the associated payments, files, add-ons, cost
breakdown, status history, walk-in transaction, notifications, and locks. It
keeps inventory movements and audit-log entries, but clears their direct order
ID links.

The function processes at most 50 orders per invocation. Storage is removed
before database rows; if a Storage or database operation fails, the order is
reported in the response/logs and can be retried by a later scheduled run.

## Deploy and schedule

1. Link the Supabase CLI to the correct project if needed:

   ```powershell
   supabase link --project-ref YOUR_PROJECT_REF
   ```

2. Generate a strong random URL-safe secret (for example, 32 random bytes
   encoded as hex). Set it for the Edge Function and keep it private:

   ```powershell
   supabase secrets set ORDER_RETENTION_CRON_SECRET=YOUR_RANDOM_SECRET
   ```

3. Deploy with JWT verification disabled because the function authenticates
   the scheduled caller using the dedicated secret header. Do not remove the
   secret check in the function:

   ```powershell
   supabase functions deploy purge-expired-orders --no-verify-jwt
   ```

4. In Supabase SQL Editor, run `supabase/order-retention-schedule.sql` once.
   The script installs a database trigger to timestamp all status transitions,
   gives existing terminal orders a fresh seven-day grace period, stores the
   project URL and cron secret in Vault, and schedules the function.
   Ensure the Vault extension is enabled in the Supabase project.
   Replace the project URL and secret placeholders in its two `vault.create_secret`
   statements with the exact values from steps 1-2. Keep the secret out of
   source control and do not paste it into application code. If changing the
   schedule later, re-run only the `cron.unschedule` / `cron.schedule` block;
   do not re-run the one-time timestamp backfill or secret creation statements.

The SQL schedules the function daily at 18:00 UTC (02:00 PHT). The seven-day
cutoff uses `orders.status_updated_at`, so cleanup can occur on the first
scheduled run after the seven-day threshold.

## Monitoring

Inspect the Edge Function's invocation logs for `[order-retention]` failures.
Successful calls return counts for eligible and deleted orders plus per-order
errors. A Storage deletion error prevents deletion of that order's database
rows so the next run can retry it.
