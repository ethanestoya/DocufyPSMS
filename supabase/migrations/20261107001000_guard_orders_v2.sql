-- Harden order updates.
--
-- Replaces the original customer-only update guard with a role-aware version:
--   * RPC / trigger / server contexts (current_user <> 'authenticated') pass.
--   * Staff and admin pass (they still use the legitimate status-management
--     path, which remains direct updates until a later change).
--   * Customers may only cancel their own order and may never touch payment,
--     deadline, hold or flag columns. Payment/plan changes go through the RPCs.

create or replace function public.guard_orders_customer_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user is distinct from 'authenticated' then
    return new;
  end if;

  if public.is_staff_or_admin() then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  -- Remaining authenticated callers are customers.
  if old.customer_id is distinct from auth.uid() then
    raise exception 'order_not_owned_by_caller' using errcode = '42501';
  end if;

  if new.status is distinct from 'Canceled' then
    raise exception 'customers_may_only_cancel_orders' using errcode = '42501';
  end if;

  if new.cancellation_reason is null or btrim(new.cancellation_reason) = '' then
    raise exception 'cancellation_reason_required' using errcode = '22023';
  end if;

  if new.order_number is distinct from old.order_number
     or new.order_source is distinct from old.order_source
     or new.customer_id is distinct from old.customer_id
     or new.customer_name is distinct from old.customer_name
     or new.customer_email is distinct from old.customer_email
     or new.customer_type is distinct from old.customer_type
     or new.total is distinct from old.total
     or new.manual_total is distinct from old.manual_total
     or new.status_updated_at is distinct from old.status_updated_at
     or new.paper_deducted_on_create is distinct from old.paper_deducted_on_create
     or new.expected_paper_usage is distinct from old.expected_paper_usage
     or new.payment_deadline is distinct from old.payment_deadline
     or new.payment_amount_paid is distinct from old.payment_amount_paid
     or new.down_payment_required is distinct from old.down_payment_required
     or new.down_payment_amount is distinct from old.down_payment_amount
     or new.down_payment_verified is distinct from old.down_payment_verified
     or new.full_payment_required is distinct from old.full_payment_required
     or new.full_payment_amount is distinct from old.full_payment_amount
     or new.full_payment_verified is distinct from old.full_payment_verified
     or new.payment_verified is distinct from old.payment_verified
     or new.payment_verified_at is distinct from old.payment_verified_at
     or new.payment_reference_number is distinct from old.payment_reference_number
     or new.payment_proof_url is distinct from old.payment_proof_url
     or new.hold_reason is distinct from old.hold_reason
     or new.notes is distinct from old.notes
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'customers_may_not_change_protected_order_fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_orders_customer_update on public.orders;
create trigger trg_guard_orders_customer_update
before update on public.orders
for each row
execute function public.guard_orders_customer_update();
