# Immediate order retention

When an order reaches `Released` or `Canceled`, a database trigger places it
in a durable cleanup queue. The Edge Function processes queued orders in
batches of up to 50, usually within one minute of the status change. Completed
orders are not eligible unless they are subsequently Released or Canceled.

Released orders are first copied into the compact `released_order_transactions`
ledger. It retains order number, customer identity, source/service category,
stored totals, paid/balance amounts, payment method/status/reference/timestamps,
placed/released times, the short status timeline needed for unclaimed-order
history, and the walk-in transaction number. Uploaded files, proof images,
file lists, print settings, and canceled-order transactions are not retained.
The worker refreshes that snapshot immediately before cleanup so status-history
events written after the release update are included.

The worker removes order-file and payment-proof objects before deleting
dependent rows. Released walk-in transaction rows are retained and unlinked
from their deleted orders; canceled walk-in transaction rows are deleted.
Inventory movements and audit entries are retained with their order links
cleared. Failed jobs have their lease released for retry; each successful
cleanup clears its queue row. The migration backfills the compact ledger for
currently retained Released orders and queues all existing Released/Canceled
orders. Applying the migration does not itself run the cleanup.

## Rollout

1. Deploy the updated worker before applying the migration. If the existing
   daily schedule calls it before the migration is applied, that invocation
   will fail to claim the not-yet-created queue; it will not delete orders.

   ```powershell
   supabase functions deploy purge-expired-orders --no-verify-jwt
   ```

2. In Supabase SQL Editor, paste and run the complete contents of
   `supabase/migrations/20261104000000_immediate_order_retention_ledger.sql`.
   It creates the ledger, durable queue, triggers and RPCs, snapshots existing
   Released orders, and queues existing terminal orders. This backfill is
   intentional: those existing orders are eligible for cleanup once the
   schedule is switched on.

3. Keep the existing `ORDER_RETENTION_CRON_SECRET` Edge Function secret and its
   two Vault secrets (`docufy_order_retention_project_url` and
   `docufy_order_retention_cron_secret`). Do not rerun the previous secret
   creation statements or the old seven-day timestamp backfill.

4. In Supabase SQL Editor, paste and run
   `supabase/order-retention-schedule.sql`. It
   replaces the old daily job with a one-minute schedule and reuses the
   existing Vault secrets. The queue is durable, so brief worker outages do
   not lose queued cleanup requests.

5. Push the application branch to Vercel separately. Vercel deploys the
   frontend only; it does not apply the migration, deploy the Edge Function,
   or change the Supabase cron schedule.

## Monitoring

Inspect the Edge Function invocation logs for `[order-retention]` failures.
Successful calls return `claimed`, `deleted`, `skipped`, and per-order failure
counts/details. Query `public.order_retention_queue` as the database owner to
inspect pending entries, `attempts`, and `last_error`. A job stays queued when
Storage or database cleanup fails, and is retried by a later invocation.

Released-order history is read from `public.released_order_transactions`;
staff/admin users have full read access, customers can read their own rows for
unclaimed-order history, and writes are trigger-only.
