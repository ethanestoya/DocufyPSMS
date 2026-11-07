-- Revoke broad direct-write grants and make the RPCs the only authenticated
-- write surface for the secured flows.
--
-- The anon role never had legitimate access here; revoke it outright. The
-- authenticated role keeps SELECT (RLS still applies) and keeps the specific
-- table writes that remain intentional (e.g. staff status updates on orders,
-- status history inserts, cost-breakdown writes, profile self-edits still gated
-- by the profiles privilege trigger). Orders/payments/attendance/order-children/
-- walk-in transactions are now written through RPCs or blocked by trigger.

revoke all on table public.orders from anon;
revoke insert on table public.orders from authenticated;

revoke all on table public.order_files from anon;
revoke insert, update, delete on table public.order_files from authenticated;

revoke all on table public.order_addons from anon;
revoke insert, update, delete on table public.order_addons from authenticated;

revoke all on table public.walk_in_transactions from anon;
revoke insert, update, delete on table public.walk_in_transactions from authenticated;

revoke all on table public.payments from anon;
revoke insert, update, delete on table public.payments from authenticated;

revoke all on table public.attendance_records from anon;
revoke insert, update, delete on table public.attendance_records from authenticated;

revoke all on table public.attendance_adjustments from anon;
revoke insert, update, delete on table public.attendance_adjustments from authenticated;

-- Keep RPC execute grants explicit (re-granted in earlier migrations too).
revoke all on function public.create_customer_order(jsonb) from public;
revoke all on function public.create_walkin_order(jsonb) from public;
revoke all on function public.set_payment_plan(uuid, text, text) from public;
revoke all on function public.submit_payment(uuid, uuid, text, text, text, text) from public;
revoke all on function public.verify_payment(uuid, text) from public;
revoke all on function public.reject_payment(uuid, text) from public;
revoke all on function public.confirm_cash_payment(uuid, text) from public;
revoke all on function public.clock_in() from public;
revoke all on function public.clock_out() from public;
revoke all on function public.admin_upsert_attendance(text, date, text, timestamptz, text) from public;
revoke all on function public.admin_set_attendance_absence(text, date, text) from public;

grant execute on function public.create_customer_order(jsonb) to authenticated;
grant execute on function public.create_walkin_order(jsonb) to authenticated;
grant execute on function public.set_payment_plan(uuid, text, text) to authenticated;
grant execute on function public.submit_payment(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.verify_payment(uuid, text) to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.confirm_cash_payment(uuid, text) to authenticated;
grant execute on function public.clock_in() to authenticated;
grant execute on function public.clock_out() to authenticated;
grant execute on function public.admin_upsert_attendance(text, date, text, timestamptz, text) to authenticated;
grant execute on function public.admin_set_attendance_absence(text, date, text) to authenticated;
