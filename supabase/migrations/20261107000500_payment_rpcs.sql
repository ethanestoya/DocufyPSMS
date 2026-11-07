-- Server-authoritative payment lifecycle.
--
-- The browser used to write payment rows directly and to patch the order's
-- payment flags/status in the same request, so a customer could submit a
-- payment amount of their choosing and staff verification was only enforced by
-- the UI. These RPCs now own that transition:
--
--   submit_payment      customer submits a proof; the amount is recomputed from
--                       the order's planned tier, never taken from the client.
--   verify_payment      staff/admin approve a submitted payment.
--   reject_payment      staff/admin reject a submitted payment.
--   confirm_cash_payment staff/admin record cash collected at the counter,
--                       including the 50% / Full choice for cash-down orders.
--
-- Payment rows can only be written through these functions once the direct
-- INSERT/UPDATE/DELETE grants are revoked in the later revoke migration.

create or replace function public.submit_payment(
  p_order_id uuid,
  p_method_id uuid default null,
  p_method_name text default null,
  p_reference text default null,
  p_proof_path text default null,
  p_amount_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_total numeric;
  v_choice text := lower(coalesce(nullif(p_amount_choice, ''), ''));
  v_amount numeric;
  v_down_required boolean;
  v_down_amount numeric;
  v_full_required boolean;
  v_full_amount numeric;
  v_method text := nullif(trim(coalesce(p_method_name, '')), '');
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
  v_payment_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.customer_id is distinct from v_uid then
    raise exception 'order_not_owned_by_caller' using errcode = '42501';
  end if;
  if v_order.status <> 'Awaiting Payment' then
    raise exception 'order_is_not_awaiting_payment' using errcode = 'P0001';
  end if;

  v_total := round(greatest(coalesce(v_order.total, 0), 0), 2);
  v_down_required := coalesce(v_order.down_payment_required, false);
  v_down_amount := coalesce(v_order.down_payment_amount, round(v_total * 0.5, 2));
  v_full_required := coalesce(v_order.full_payment_required, false);
  v_full_amount := coalesce(v_order.full_payment_amount, v_total);

  if v_choice not in ('', 'partial', 'down', 'full') then
    raise exception 'invalid_amount_choice' using errcode = '22023';
  end if;

  if v_choice = 'full' then
    v_down_required := false;
    v_down_amount := null;
    v_full_required := true;
    v_full_amount := v_total;
    v_amount := v_total;
  elsif v_choice in ('partial', 'down') then
    v_down_required := true;
    v_down_amount := round(v_total * 0.5, 2);
    v_full_required := false;
    v_full_amount := null;
    v_amount := v_down_amount;
  elsif v_down_required then
    v_full_required := false;
    v_full_amount := null;
    v_amount := v_down_amount;
  else
    v_full_required := true;
    v_full_amount := v_total;
    v_down_required := false;
    v_down_amount := null;
    v_amount := v_full_amount;
  end if;

  insert into public.payments (
    order_id, method_id, method_name, amount, reference_number,
    proof_storage_path, status, submitted_by, submitted_at
  ) values (
    p_order_id,
    case when p_method_id is not null then p_method_id else null end,
    coalesce(v_method, 'Cash'),
    v_amount,
    v_reference,
    nullif(p_proof_path, ''),
    'pending',
    v_uid,
    now()
  )
  returning id into v_payment_id;

  update public.orders
     set down_payment_required = v_down_required,
         down_payment_amount = v_down_amount,
         down_payment_verified = false,
         full_payment_required = v_full_required,
         full_payment_amount = v_full_amount,
         full_payment_verified = false,
         payment_amount_paid = v_amount,
         payment_deadline = null,
         hold_reason = format(
           '%s payment of ₱%s is pending verification. Your order will be queued once the payment is verified.',
           coalesce(v_method, 'Online'), round(v_amount)
         ),
         updated_at = now()
   where id = p_order_id;

  return jsonb_build_object('id', v_payment_id, 'amount', v_amount);
end;
$$;

create or replace function public.verify_payment(
  p_payment_id uuid,
  p_amount_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_total numeric;
  v_choice text := lower(coalesce(nullif(p_amount_choice, ''), ''));
  v_amount numeric;
  v_is_down boolean := false;
  v_old_status public.order_status;
  v_new_status public.order_status;
begin
  if not public.is_staff_or_admin() then
    raise exception 'payment_verification_requires_staff_or_admin' using errcode = '42501';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'payment_is_not_pending' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  v_total := round(greatest(coalesce(v_order.total, 0), 0), 2);

  if coalesce(v_order.down_payment_required, false) then
    v_is_down := v_choice <> 'full';
  elsif v_choice = 'down' then
    v_is_down := true;
  end if;

  if v_is_down then
    v_amount := coalesce(v_order.down_payment_amount, round(v_total * 0.5, 2));
    if v_payment.amount between (v_total * 0.5 - 1) and (v_total * 0.5 + 1) then
      v_amount := v_payment.amount;
    end if;
    update public.orders
       set down_payment_required = true,
           down_payment_amount = v_amount,
           down_payment_verified = true,
           full_payment_required = false,
           full_payment_amount = null,
           full_payment_verified = false,
           payment_amount_paid = v_amount,
           hold_reason = null,
           payment_deadline = null,
           updated_at = now()
     where id = v_order.id;
  else
    v_amount := coalesce(v_order.full_payment_amount, v_total);
    update public.orders
       set down_payment_required = false,
           down_payment_amount = null,
           down_payment_verified = false,
           full_payment_required = true,
           full_payment_amount = v_total,
           full_payment_verified = true,
           payment_amount_paid = v_total,
           hold_reason = null,
           payment_deadline = null,
           updated_at = now()
     where id = v_order.id;
  end if;

  -- Only advance the queue when the order has not already moved on. A low-value
  -- Cash on Pickup order is queued at checkout and may already be Printing.
  v_old_status := v_order.status;
  if v_order.status = 'Awaiting Payment' then
    v_new_status := 'In Queue';
    update public.orders
       set status = v_new_status
     where id = v_order.id;

    insert into public.order_status_history (order_id, old_status, new_status, reason, changed_by)
    values (v_order.id, v_old_status, v_new_status, 'Payment verified', auth.uid());
  else
    v_new_status := v_order.status;
  end if;

  update public.payments
     set status = 'verified',
         verified_by = auth.uid(),
         verified_at = now()
   where id = v_payment.id;

  return jsonb_build_object(
    'orderId', v_order.id,
    'oldStatus', v_old_status,
    'newStatus', v_new_status,
    'amount', v_amount
  );
end;
$$;

create or replace function public.reject_payment(
  p_payment_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
begin
  if not public.is_staff_or_admin() then
    raise exception 'payment_verification_requires_staff_or_admin' using errcode = '42501';
  end if;

  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;
  if v_payment.status <> 'pending' then
    raise exception 'payment_is_not_pending' using errcode = 'P0001';
  end if;

  update public.payments
     set status = 'rejected',
         rejection_reason = coalesce(nullif(trim(p_reason), ''), 'Rejected'),
         verified_by = auth.uid(),
         verified_at = now()
   where id = v_payment.id;

  return jsonb_build_object('orderId', v_payment.order_id, 'amount', v_payment.amount);
end;
$$;

create or replace function public.confirm_cash_payment(
  p_order_id uuid,
  p_amount_choice text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_total numeric;
  v_choice text := lower(coalesce(nullif(p_amount_choice, ''), ''));
  v_is_down boolean := false;
  v_amount numeric;
  v_new_status public.order_status;
  v_payment_id uuid;
begin
  if not public.is_staff_or_admin() then
    raise exception 'payment_verification_requires_staff_or_admin' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.status = 'Canceled' then
    raise exception 'order_is_canceled' using errcode = 'P0001';
  end if;

  v_total := round(greatest(coalesce(v_order.total, 0), 0), 2);

  if coalesce(v_order.down_payment_required, false) and v_choice <> 'full' then
    v_is_down := true;
  elsif v_choice = 'down' then
    v_is_down := true;
  end if;

  if v_is_down then
    v_amount := coalesce(v_order.down_payment_amount, round(v_total * 0.5, 2));
    update public.orders
       set down_payment_required = true,
           down_payment_amount = v_amount,
           down_payment_verified = true,
           full_payment_required = false,
           full_payment_amount = null,
           full_payment_verified = false,
           payment_amount_paid = v_amount,
           hold_reason = null,
           payment_deadline = null,
           updated_at = now()
     where id = v_order.id;
  else
    v_amount := v_total;
    update public.orders
       set down_payment_required = false,
           down_payment_amount = null,
           down_payment_verified = false,
           full_payment_required = true,
           full_payment_amount = v_total,
           full_payment_verified = true,
           payment_amount_paid = v_total,
           hold_reason = null,
           payment_deadline = null,
           updated_at = now()
     where id = v_order.id;
  end if;

  if v_order.status = 'Awaiting Payment' then
    v_new_status := 'In Queue';
    update public.orders set status = v_new_status where id = v_order.id;
    insert into public.order_status_history (order_id, old_status, new_status, reason, changed_by)
    values (v_order.id, v_order.status, v_new_status, 'Cash payment confirmed at the shop', auth.uid());
  else
    v_new_status := v_order.status;
  end if;

  insert into public.payments (
    order_id, method_name, amount, status, submitted_by, verified_by, submitted_at, verified_at
  ) values (
    v_order.id, 'Cash', v_amount, 'verified', auth.uid(), auth.uid(), now(), now()
  )
  returning id into v_payment_id;

  return jsonb_build_object(
    'orderId', v_order.id,
    'newStatus', v_new_status,
    'amount', v_amount,
    'paymentId', v_payment_id
  );
end;
$$;

revoke all on function public.submit_payment(uuid, uuid, text, text, text, text) from public;
revoke all on function public.verify_payment(uuid, text) from public;
revoke all on function public.reject_payment(uuid, text) from public;
revoke all on function public.confirm_cash_payment(uuid, text) from public;

grant execute on function public.submit_payment(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.verify_payment(uuid, text) to authenticated;
grant execute on function public.reject_payment(uuid, text) to authenticated;
grant execute on function public.confirm_cash_payment(uuid, text) to authenticated;
