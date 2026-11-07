-- Payment deadline + the customer's down-payment plan.
--
-- `resolve_payment_deadline` is the SQL twin of `utils/paymentDeadline.ts`:
-- the deadline is the EARLIER of the admin-configured window and the shop's
-- closing time on the day the order was placed. Placing an order within 30
-- minutes of closing earns a 30-minute grace that still ends at 23:59:59.999
-- PHT; placing at/after closing blocks the order for the day.
--
-- `set_payment_plan` is the only way a customer can change the down/full
-- requirement of their own Awaiting Payment order. Before it existed the
-- browser PATCHed those flags directly, so a customer could mark an order
-- fully paid or erase the amount they owed.

create or replace function public.resolve_payment_deadline(p_kind text)
returns timestamptz
language plpgsql
stable
as $$
declare
  v_window integer;
  v_closing_text text;
  v_closing_time time;
  v_today date;
  v_closing_ts timestamptz;
  v_window_ts timestamptz;
  v_now timestamptz := now();
  v_kind text := lower(coalesce(p_kind, 'online'));
begin
  select case
           when v_kind = 'cash' then cash_payment_window_seconds
           else online_payment_window_seconds
         end
    into v_window
    from public.pricing_settings
   where id = true;

  if v_window is null then
    v_window := case when v_kind = 'cash' then 172800 else 86400 end;
  end if;

  select content->>'shopClosingTime'
    into v_closing_text
    from public.landing_content
   limit 1;

  if v_closing_text is null or v_closing_text = '' then
    return case when v_window > 0 then v_now + make_interval(secs => v_window) else null end;
  end if;

  begin
    v_closing_time := v_closing_text::time;
  exception when others then
    return case when v_window > 0 then v_now + make_interval(secs => v_window) else null end;
  end;

  v_today := (v_now at time zone 'Asia/Manila')::date;
  v_closing_ts := (v_today + v_closing_time) at time zone 'Asia/Manila';
  v_window_ts := case
                   when v_window > 0 then v_now + make_interval(secs => v_window)
                   else v_closing_ts
                 end;

  if v_now >= v_closing_ts then
    raise exception 'shop_closed_for_the_day'
      using errcode = 'P0001',
            hint = 'Orders cannot be placed at or after the shop closing time.';
  end if;

  if v_closing_ts - v_now <= interval '30 minutes' then
    return least(
      v_closing_ts + interval '30 minutes',
      (v_today + time '23:59:59.999') at time zone 'Asia/Manila'
    );
  end if;

  return least(v_window_ts, v_closing_ts);
end;
$$;

create or replace function public.set_payment_plan(
  p_order_id uuid,
  p_venue text,
  p_amount_choice text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_total numeric;
  v_down numeric;
  v_venue text := lower(coalesce(p_venue, 'online'));
  v_choice text := lower(coalesce(p_amount_choice, 'down'));
  v_kind text;
  v_deadline timestamptz;
  v_hold text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_venue not in ('shop', 'online') then
    raise exception 'invalid_payment_venue' using errcode = '22023';
  end if;
  if v_choice not in ('down', 'full') then
    raise exception 'invalid_amount_choice' using errcode = '22023';
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;
  if v_order.customer_id is distinct from auth.uid() then
    raise exception 'order_not_owned_by_caller' using errcode = '42501';
  end if;
  if v_order.status <> 'Awaiting Payment' then
    raise exception 'order_is_not_awaiting_payment' using errcode = 'P0001';
  end if;

  v_total := coalesce(v_order.total, 0);
  v_down := round(v_total * 0.5, 2);
  v_kind := case when v_venue = 'shop' then 'cash' else 'online' end;
  v_deadline := public.resolve_payment_deadline(v_kind);

  if v_choice = 'down' then
    v_hold := case
      when v_venue = 'shop' then format(
        'Cash on Pickup: pay ₱%s (down payment of ₱%s — 50%% of the total) at the shop before your payment deadline to confirm this order.',
        round(v_total), round(v_down)
      )
      else format(
        'Online down payment of ₱%s (50%% of total ₱%s) is pending verification. Your order will be queued once the down payment is verified.',
        round(v_down), round(v_total)
      )
    end;

    update public.orders
       set down_payment_required = true,
           down_payment_amount = v_down,
           down_payment_verified = false,
           full_payment_required = false,
           full_payment_amount = null,
           full_payment_verified = false,
           hold_reason = v_hold,
           payment_deadline = v_deadline,
           updated_at = now()
     where id = p_order_id;
  else
    v_hold := case
      when v_venue = 'shop' then format(
        'Cash on Pickup: pay ₱%s (full payment) at the shop before your payment deadline to confirm this order.',
        round(v_total)
      )
      else format(
        'Online full payment of ₱%s is pending verification. Your order will be queued once the full payment is verified.',
        round(v_total)
      )
    end;

    update public.orders
       set down_payment_required = false,
           down_payment_amount = null,
           down_payment_verified = false,
           full_payment_required = true,
           full_payment_amount = v_total,
           full_payment_verified = false,
           hold_reason = v_hold,
           payment_deadline = v_deadline,
           updated_at = now()
     where id = p_order_id;
  end if;
end;
$$;

revoke all on function public.set_payment_plan(uuid, text, text) from public;
grant execute on function public.set_payment_plan(uuid, text, text) to authenticated;
