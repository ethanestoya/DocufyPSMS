-- Server-authoritative order creation.
--
-- Before this migration both order flows INSERTed the order row, the file rows
-- and the money columns directly from the browser, then the server trusted
-- everything it was told (`total`, `down_payment_required`, `hold_reason`,
-- `payment_deadline`, payment flags). A customer could therefore place a ₱0
-- order, mark it fully paid, or write a deadline of their choosing.
--
-- These two RPCs are now the only supported way to create an order:
--   * `create_customer_order` prices the files/add-ons from the matrix, derives
--     the payment tier from the server-side thresholds and mints the deadline
--     from the server-side clock;
--   * `create_walkin_order` does the same for staff/admin counter sales and
--     writes the companion walk-in transaction log in the same transaction.
--
-- Both are SECURITY DEFINER (owned by postgres) so the order/file/addon writes
-- succeed even after the direct table grants are revoked from `authenticated`.

create or replace function public.insert_order_children(
  p_order_id uuid,
  p_files jsonb,
  p_addons jsonb,
  p_printing_cost numeric,
  p_addons_cost numeric,
  p_total numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_file jsonb;
  v_addon jsonb;
begin
  for v_file in select value from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    insert into public.order_files (
      order_id, storage_path, original_name, mime_type, size_bytes, page_count,
      print_type, content_type, paper_size, copies, color_mode, page_range,
      specific_pages, pages_per_sheet, orientation, two_sided, margins, scale,
      custom_scale, photo_size, photo_quantity, notes, color_pct
    ) values (
      p_order_id,
      nullif(v_file->>'storagePath', ''),
      coalesce(nullif(v_file->>'originalName', ''), nullif(v_file->>'name', ''), 'document'),
      nullif(v_file->>'mimeType', ''),
      nullif(v_file->>'sizeBytes', '')::bigint,
      nullif(v_file->>'pageCount', '')::integer,
      nullif(v_file->>'printType', ''),
      nullif(v_file->>'contentType', ''),
      nullif(v_file->>'paperSize', ''),
      greatest(1, coalesce(nullif(v_file->>'copies', '')::integer, 1)),
      nullif(v_file->>'colorMode', ''),
      nullif(v_file->>'pageRange', ''),
      nullif(v_file->>'specificPages', ''),
      nullif(v_file->>'pagesPerSheet', ''),
      nullif(v_file->>'orientation', ''),
      nullif(v_file->>'twoSided', ''),
      nullif(v_file->>'margins', ''),
      nullif(v_file->>'scale', ''),
      nullif(v_file->>'customScale', '')::numeric,
      nullif(v_file->>'photoSize', ''),
      nullif(v_file->>'photoQuantity', '')::integer,
      nullif(v_file->>'notes', ''),
      nullif(v_file->>'colorPct', '')::numeric
    );
  end loop;

  for v_addon in select value from jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) loop
    insert into public.order_addons (
      order_id, name, quantity, unit_price, inventory_item_id
    ) values (
      p_order_id,
      coalesce(nullif(v_addon->>'name', ''), nullif(v_addon->>'label', ''), 'Add-on'),
      greatest(0, coalesce(nullif(v_addon->>'quantity', '')::integer, 1)),
      greatest(0, coalesce(nullif(v_addon->>'unitPrice', '')::numeric, 0)),
      case
        when nullif(v_addon->>'inventoryItemId', '') is not null
             and exists (
               select 1 from public.inventory_items i
                where i.id::text = v_addon->>'inventoryItemId'
             )
          then (v_addon->>'inventoryItemId')::uuid
        else null
      end
    );
  end loop;

  insert into public.order_cost_breakdowns (order_id, printing_cost, addons_cost, total)
  values (p_order_id, p_printing_cost, p_addons_cost, p_total)
  on conflict (order_id) do update
    set printing_cost = excluded.printing_cost,
        addons_cost = excluded.addons_cost,
        total = excluded.total;
end;
$$;

create or replace function public.create_customer_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_files jsonb := coalesce(payload->'files', '[]'::jsonb);
  v_addons jsonb := coalesce(payload->'addons', '[]'::jsonb);
  v_addon_count integer := 0;
  v_printing numeric;
  v_addons_total numeric;
  v_total numeric;
  v_method text := coalesce(nullif(payload->>'paymentMethod', ''), 'Cash');
  v_is_online boolean;
  v_amount_choice text := lower(coalesce(nullif(payload->>'amountChoice', ''), ''));
  v_down_threshold numeric;
  v_full_threshold numeric;
  v_down_required boolean := false;
  v_down_amount numeric;
  v_full_required boolean := false;
  v_full_amount numeric;
  v_status public.order_status;
  v_hold_reason text;
  v_deadline timestamptz;
  v_paper jsonb;
  v_id uuid;
  v_number bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if jsonb_array_length(v_files) = 0 then
    raise exception 'order_requires_at_least_one_file' using errcode = '22023';
  end if;
  if jsonb_array_length(v_files) > 20 then
    raise exception 'order_file_limit_exceeded' using errcode = '22023';
  end if;

  -- Reject impossible measurements before they reach the pricing math.
  if exists (
    select 1
      from jsonb_array_elements(v_files) f
     where coalesce(nullif(f->>'pageCount', '')::integer, 0) < 0
        or coalesce(nullif(f->>'pageCount', '')::integer, 0) > 5000
        or coalesce(nullif(f->>'copies', '')::integer, 1) < 1
        or coalesce(nullif(f->>'copies', '')::integer, 1) > 100
        or coalesce(nullif(f->>'colorPct', '')::numeric, 0) < 0
        or coalesce(nullif(f->>'colorPct', '')::numeric, 0) > 100
  ) then
    raise exception 'invalid_file_measurements' using errcode = '22023';
  end if;

  select count(*) into v_addon_count from jsonb_array_elements(v_addons);
  if v_addon_count > 20 then
    raise exception 'order_addon_limit_exceeded' using errcode = '22023';
  end if;

  select printing_cost, addons_cost, total
    into v_printing, v_addons_total, v_total
    from public.compute_order_totals(v_files, v_addons);
  v_printing := coalesce(v_printing, 0);
  v_addons_total := coalesce(v_addons_total, 0);
  v_total := coalesce(v_total, 0);

  select coalesce(down_payment_threshold, 50), coalesce(full_payment_threshold, 100)
    into v_down_threshold, v_full_threshold
    from public.pricing_settings
   where id = true;
  v_down_threshold := coalesce(v_down_threshold, 50);
  v_full_threshold := coalesce(v_full_threshold, 100);

  v_is_online := lower(v_method) <> 'cash';

  if v_total >= v_full_threshold then
    v_full_required := true;
    v_full_amount := v_total;
    if not v_is_online then
      raise exception 'cash_on_pickup_is_not_allowed_for_full_payment_orders'
        using errcode = 'P0001';
    end if;
  elsif v_total >= v_down_threshold then
    v_down_required := true;
    v_down_amount := round(v_total * 0.5, 2);
  end if;

  v_paper := public.compute_expected_paper_usage(v_files);

  -- Low-value Cash on Pickup is the only customer order that starts in the
  -- print queue: the shop prints first and collects the cash at pickup.
  if (not v_is_online) and (not v_full_required) and v_total < v_down_threshold then
    v_status := 'In Queue';
    v_deadline := null;
    v_hold_reason := format(
      'Cash on Pickup: pay ₱%s at the shop when picking up this order. This order is already in the print queue.',
      round(v_total)
    );
  else
    v_status := 'Awaiting Payment';
    v_deadline := public.resolve_payment_deadline(case when v_is_online then 'online' else 'cash' end);

    if v_is_online and v_full_required then
      v_hold_reason := format(
        '%s full payment of ₱%s is pending verification. Your order will be queued once the full payment is verified.',
        v_method, round(v_total)
      );
    elsif v_is_online and v_down_required then
      v_hold_reason := format(
        '%s down payment of ₱%s (50%% of total ₱%s) is pending verification. Your order will be queued once the down payment is verified.',
        v_method, round(v_down_amount), round(v_total)
      );
    elsif v_is_online then
      v_hold_reason := format(
        '%s payment of ₱%s is pending verification. Your order will be queued once the payment is verified.',
        v_method, round(v_total)
      );
    else
      v_hold_reason := format(
        'Cash on Pickup: pay ₱%s%s at the shop before your payment deadline to confirm this order.',
        round(v_total),
        case
          when v_down_required then format(' (down payment of ₱%s — 50%% of the total)', round(v_down_amount))
          else ''
        end
      );
    end if;
  end if;

  insert into public.orders (
    customer_id, customer_name, customer_email, status, order_source, customer_type,
    subtotal, addons_total, total, manual_total, hold_reason, payment_deadline,
    down_payment_required, down_payment_amount, down_payment_verified,
    full_payment_required, full_payment_amount, full_payment_verified,
    payment_amount_paid, expected_paper_usage, paper_deducted_on_create,
    paper_confirmed, error_usage, notes, status_updated_at, created_at, updated_at
  ) values (
    v_uid,
    coalesce(nullif(payload->>'customerName', ''), 'Customer'),
    coalesce(nullif(payload->>'customerEmail', ''), 'customer@example.com'),
    v_status,
    'online',
    nullif(payload->>'customerType', ''),
    v_printing,
    v_addons_total,
    v_total,
    null,
    v_hold_reason,
    v_deadline,
    v_down_required,
    v_down_amount,
    false,
    v_full_required,
    v_full_amount,
    false,
    0,
    v_paper,
    false,
    false,
    null,
    coalesce(payload->>'notes', ''),
    now(),
    now(),
    now()
  )
  returning id, order_number into v_id, v_number;

  perform public.insert_order_children(
    v_id, v_files, v_addons, v_printing, v_addons_total, v_total
  );

  insert into public.order_status_history (order_id, old_status, new_status, reason, changed_by)
  values (v_id, null, v_status, v_hold_reason, v_uid);

  return jsonb_build_object('id', v_id, 'orderNumber', v_number);
end;
$$;

create or replace function public.create_walkin_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_files jsonb := coalesce(payload->'files', '[]'::jsonb);
  v_addons jsonb := coalesce(payload->'addons', '[]'::jsonb);
  v_customer_type text := coalesce(nullif(payload->>'customerType', ''), 'printing');
  v_is_photocopy boolean := lower(v_customer_type) = 'photocopy';
  v_printing numeric;
  v_addons_total numeric;
  v_total numeric;
  v_manual numeric;
  v_paper jsonb;
  v_customer_name text;
  v_customer_email text;
  v_id uuid;
  v_number bigint;
begin
  if not public.is_staff_or_admin() then
    raise exception 'walk_in_orders_require_staff_or_admin' using errcode = '42501';
  end if;

  if not v_is_photocopy then
    if jsonb_array_length(v_files) = 0 then
      raise exception 'order_requires_at_least_one_file' using errcode = '22023';
    end if;
    if jsonb_array_length(v_files) > 20 then
      raise exception 'order_file_limit_exceeded' using errcode = '22023';
    end if;
  end if;

  v_customer_name := coalesce(
    nullif(payload->>'customerName', ''),
    nullif(payload->>'customer', ''),
    'Walk-in Customer'
  );
  v_customer_email := coalesce(
    nullif(payload->>'customerEmail', ''),
    'walkin+' || replace(gen_random_uuid()::text, '-', '') || '@docufy.local'
  );

  if v_is_photocopy then
    v_manual := round(greatest(0, coalesce(nullif(payload->>'manualTotal', '')::numeric, 0)), 2);
    v_printing := v_manual;
    v_addons_total := 0;
    v_total := v_manual;
    v_paper := coalesce(
      payload->'expectedPaperUsage',
      jsonb_build_array(jsonb_build_object(
        'size', coalesce(nullif(payload->>'paperSize', ''), 'a4'),
        'sheets', greatest(0, coalesce(nullif(payload->>'copies', '')::integer, 0))
      ))
    );
  else
    select printing_cost, addons_cost, total
      into v_printing, v_addons_total, v_total
      from public.compute_order_totals(v_files, v_addons);
    v_printing := coalesce(v_printing, 0);
    v_addons_total := coalesce(v_addons_total, 0);
    v_total := coalesce(v_total, 0);
    v_manual := null;
    v_paper := coalesce(payload->'expectedPaperUsage', public.compute_expected_paper_usage(v_files));
  end if;

  insert into public.orders (
    customer_id, customer_name, customer_email, status, order_source, customer_type,
    subtotal, addons_total, total, manual_total, hold_reason, payment_deadline,
    down_payment_required, down_payment_amount, down_payment_verified,
    full_payment_required, full_payment_amount, full_payment_verified,
    payment_amount_paid, expected_paper_usage, paper_deducted_on_create,
    paper_confirmed, error_usage, notes, status_updated_at, created_at, updated_at
  ) values (
    null,
    v_customer_name,
    v_customer_email,
    'In Queue',
    'walkin',
    v_customer_type,
    v_printing,
    v_addons_total,
    v_total,
    v_manual,
    null,
    null,
    false,
    null,
    false,
    false,
    null,
    false,
    v_total,
    v_paper,
    false,
    false,
    null,
    coalesce(payload->>'notes', ''),
    now(),
    now(),
    now()
  )
  returning id, order_number into v_id, v_number;

  perform public.insert_order_children(
    v_id, v_files, v_addons, v_printing, v_addons_total, v_total
  );

  insert into public.order_status_history (order_id, old_status, new_status, reason, changed_by)
  values (v_id, null, 'In Queue', null, auth.uid());

  insert into public.walk_in_transactions (
    order_id, customer_name, customer_type, total, payment_method, created_by
  ) values (
    v_id, v_customer_name, v_customer_type, v_total, 'Cash', auth.uid()
  );

  return jsonb_build_object('id', v_id, 'orderNumber', v_number);
end;
$$;

revoke all on function public.create_customer_order(jsonb) from public;
revoke all on function public.create_walkin_order(jsonb) from public;
revoke all on function public.insert_order_children(uuid, jsonb, jsonb, numeric, numeric, numeric) from public;
grant execute on function public.create_customer_order(jsonb) to authenticated;
grant execute on function public.create_walkin_order(jsonb) to authenticated;
