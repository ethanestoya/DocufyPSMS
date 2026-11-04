-- ============================================================================
-- Docufy PSMS — REMOVE mock order data (run to undo supabase/seed_mock_orders.sql)
-- ----------------------------------------------------------------------------
-- Deletes EVERYTHING created by supabase/seed_mock_orders.sql — the mock orders
-- and every row hanging off them — and nothing else. Scoped STRICTLY to
-- addresses ending in '@docufy.mock' plus the a1…a7 id prefixes that seed uses,
-- so real orders and the @docufy.demo accounts are never touched.
--
-- RUN THIS IN: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once (nothing left to delete = no-op).
--
-- ORDER MATTERS: rows are deleted child-first so foreign keys never block the
-- delete even when the schema has no ON DELETE rules.
--
-- NOT DELETED ON PURPOSE: the shop closing time. seed_mock_orders.sql only sets
-- it when it was blank, and it is a shop setting rather than mock data, so this
-- script leaves it alone. Change it in
-- Admin -> Management -> Landing Page -> Shop Information.
--
-- NO AUTH ROWS ARE CREATED by this seed (customer_id stays null), so there is
-- nothing to remove from auth.users or profiles.
-- ============================================================================


-- ============================================================================
-- STEP 1 — OPTIONAL PREVIEW
-- Uncomment this block and run it ALONE first to see what will be removed.
-- It is a read-only SELECT; it deletes nothing.
-- ============================================================================
--
-- with mock as (
--   select id from public.orders where customer_email like '%@docufy.mock'
-- )
-- select 'orders'                     as table_name, count(*) from public.orders where customer_email like '%@docufy.mock'
-- union all select 'order_files',            count(*) from public.order_files             where order_id in (select id from mock)
-- union all select 'order_addons',           count(*) from public.order_addons            where order_id in (select id from mock)
-- union all select 'order_status_history',   count(*) from public.order_status_history    where order_id in (select id from mock)
-- union all select 'order_cost_breakdowns',  count(*) from public.order_cost_breakdowns   where order_id in (select id from mock)
-- union all select 'payments',               count(*) from public.payments                where order_id in (select id from mock)
-- union all select 'walk_in_transactions',   count(*) from public.walk_in_transactions    where order_id in (select id from mock)
-- union all select 'notifications',          count(*) from public.notifications           where related_order_id in (select id from mock)
-- union all select 'order_locks',            count(*) from public.order_locks             where order_id in (select id from mock)
-- union all select 'unclaimed_offense_overrides', count(*) from public.unclaimed_offense_overrides where customer_key like '%@docufy.mock'
-- union all select 'customer_restrictions',  count(*) from public.customer_restrictions   where customer_key like '%@docufy.mock'
-- union all select 'released_order_transactions', count(*) from public.released_order_transactions where customer_email like '%@docufy.mock'
-- order by table_name;


-- ============================================================================
-- STEP 2 — THE REMOVAL (run this)
-- ============================================================================

begin;

-- 0. Stop the retention worker from chasing rows that are about to disappear.
--    Skipped cleanly when the immediate-retention migration is not applied.
do $$
begin
  delete from public.order_retention_queue
   where order_id in (select id from public.orders where customer_email like '%@docufy.mock');
exception when undefined_table then
  raise notice 'reset: order_retention_queue does not exist — skipped.';
end $$;

-- 1. Notifications tied to the mock orders.
delete from public.notifications
 where related_order_id in (select id from public.orders where customer_email like '%@docufy.mock');

-- 2 + 3. The admin layer: per-offense decisions and customer restrictions.
--        Both tables are optional, so their deletes skip themselves if absent.
do $$
begin
  delete from public.unclaimed_offense_overrides
   where order_id in (select id from public.orders where customer_email like '%@docufy.mock')
      or customer_key like '%@docufy.mock';

  delete from public.customer_restrictions
   where customer_key like '%@docufy.mock'
      or customer_email like '%@docufy.mock';
exception when undefined_table then
  raise notice 'reset: unclaimed_offense_overrides / customer_restrictions do not exist — skipped.';
end $$;

-- 4. Order status timelines — what Pickup Monitoring and Unclaimed derive from.
delete from public.order_status_history
 where order_id in (select id from public.orders where customer_email like '%@docufy.mock');

-- 5. Payments.
delete from public.payments
 where order_id in (select id from public.orders where customer_email like '%@docufy.mock');

-- 6. Cost breakdowns and add-on lines.
delete from public.order_cost_breakdowns
 where order_id in (select id from public.orders where customer_email like '%@docufy.mock');

delete from public.order_addons
 where order_id in (select id from public.orders where customer_email like '%@docufy.mock');

-- 7. Uploaded-file records (storage_path is always null for these rows, so
--    there is nothing in Storage to clean up).
delete from public.order_files
 where order_id in (select id from public.orders where customer_email like '%@docufy.mock');

-- 8. Session locks held against the mock orders.
delete from public.order_locks
 where order_id in (select id from public.orders where customer_email like '%@docufy.mock');

-- 9. Walk-in transaction log rows (unlink first — order_id may be set null by
--    the retention worker rather than the row deleted).
delete from public.walk_in_transactions
 where order_id in (select id from public.orders where customer_email like '%@docufy.mock')
    or customer_name = 'Walk-in Customer (mock)';

-- 10. Released-order ledger snapshots the retention trigger captured from the
--     mock Released orders. Without this the Released history would linger.
do $$
begin
  delete from public.released_order_transactions
   where customer_email like '%@docufy.mock'
      or archived_order_id in (select id from public.orders where customer_email like '%@docufy.mock');
exception when undefined_table then
  raise notice 'reset: released_order_transactions does not exist — skipped.';
end $$;

-- 11. The orders themselves.
delete from public.orders
 where customer_email like '%@docufy.mock';

commit;

-- The three guarded blocks above catch a missing table and skip it, so this
-- script runs the same whether or not the retention migration and the
-- restrictions tables exist in your project.
-- ============================================================================


-- ============================================================================
-- STEP 3 — VERIFICATION (should read 0)
-- ============================================================================

select count(*) as mock_orders_left
from public.orders
where customer_email like '%@docufy.mock';
