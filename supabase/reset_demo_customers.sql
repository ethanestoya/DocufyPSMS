-- ============================================================================
-- Docufy PSMS — RESET demo customer data (run BEFORE re-seeding)
-- ----------------------------------------------------------------------------
-- Removes EVERYTHING created by supabase/seed_demo_customers.sql — the demo
-- auth users and every row that hangs off them — so the function-mapped demo
-- set can be seeded cleanly. Scoped STRICTLY to emails ending in
-- '@docufy.demo'; no real account is ever touched.
--
-- RUN THIS IN: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- It is safe to run more than once (nothing to delete = no-op).
--
-- ORDER MATTERS: rows are deleted child-first so foreign keys never block the
-- delete even when the schema has no ON DELETE rules.
-- ============================================================================


-- ============================================================================
-- STEP 1 — OPTIONAL PREVIEW
-- Uncomment the block below and run it ALONE first to see what will be removed.
-- (It is a read-only SELECT; it deletes nothing.)
-- ============================================================================
--
-- select 'orders'                as table_name, count(*) from public.orders                where customer_email like '%@docufy.demo'
-- union all select 'order_status_history',     count(*) from public.order_status_history where order_id in (select id from public.orders where customer_email like '%@docufy.demo')
-- union all select 'payments',                 count(*) from public.payments             where order_id in (select id from public.orders where customer_email like '%@docufy.demo')
-- union all select 'order_cost_breakdowns',    count(*) from public.order_cost_breakdowns where order_id in (select id from public.orders where customer_email like '%@docufy.demo')
-- union all select 'order_locks',              count(*) from public.order_locks          where order_id in (select id from public.orders where customer_email like '%@docufy.demo')
-- union all select 'walk_in_transactions',     count(*) from public.walk_in_transactions where order_id in (select id from public.orders where customer_email like '%@docufy.demo')
-- union all select 'notifications',            count(*) from public.notifications        where related_order_id in (select id from public.orders where customer_email like '%@docufy.demo') or recipient_profile_id in (select id from public.profiles where email like '%@docufy.demo')
-- union all select 'job_applications',         count(*) from public.job_applications     where applicant_profile_id in (select id from public.profiles where email like '%@docufy.demo')
-- union all select 'profiles',                 count(*) from public.profiles             where email like '%@docufy.demo'
-- union all select 'auth.users',               count(*) from auth.users                  where email like '%@docufy.demo'
-- order by table_name;


-- ============================================================================
-- STEP 2 — THE RESET (run this)
-- ============================================================================

begin;

-- 1. Notifications tied to demo customers or their orders.
delete from public.notifications
 where related_order_id in (select id from public.orders where customer_email like '%@docufy.demo')
    or recipient_profile_id in (select id from public.profiles where email like '%@docufy.demo');

-- 2. Order status timeline.
delete from public.order_status_history
 where order_id in (select id from public.orders where customer_email like '%@docufy.demo');

-- 3. Payments.
delete from public.payments
 where order_id in (select id from public.orders where customer_email like '%@docufy.demo');

-- 4. Cost breakdowns.
delete from public.order_cost_breakdowns
 where order_id in (select id from public.orders where customer_email like '%@docufy.demo');

-- 5. Session locks (by demo order, or locked by a demo profile).
delete from public.order_locks
 where order_id in (select id from public.orders where customer_email like '%@docufy.demo')
    or locked_by in (select id from public.profiles where email like '%@docufy.demo');

-- 6. Walk-in transaction logs (defensive — demo orders are online).
delete from public.walk_in_transactions
 where order_id in (select id from public.orders where customer_email like '%@docufy.demo');

-- 7. Job applications by demo profiles.
delete from public.job_applications
 where applicant_profile_id in (select id from public.profiles where email like '%@docufy.demo');

-- 8. Orders.
delete from public.orders
 where customer_email like '%@docufy.demo';

-- 9. Profiles.
delete from public.profiles
 where email like '%@docufy.demo';

-- 10. Auth identities.
delete from auth.identities
 where user_id in (select id from auth.users where email like '%@docufy.demo');

-- 11. Auth users.
delete from auth.users
 where email like '%@docufy.demo';

commit;

-- If the final auth.users delete is ever blocked by a foreign key on your
-- project, delete the accounts from Dashboard -> Authentication -> Users
-- instead; every public.* row above is already gone by then.
-- ============================================================================
