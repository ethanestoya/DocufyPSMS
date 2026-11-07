-- Child-table row validation.
--
-- Even with restrictive RLS, a direct insert that slips through must still
-- belong to an order the caller may actually create for, and the numbers must
-- be non-negative / sane. These checks back up the RPC-owned order path.

create or replace function public.guard_order_file_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order record;
begin
  if current_user is distinct from 'authenticated' then
    return new;
  end if;

  select id, order_source, customer_id, created_by
    into v_order
    from public.orders
   where id = new.order_id;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if public.is_staff_or_admin() then
    null;
  elsif v_order.order_source = 'online' and v_order.customer_id = auth.uid() then
    null;
  else
    raise exception 'order_file_insert_not_allowed' using errcode = '42501';
  end if;

  if coalesce(new.page_count, 0) < 0 or coalesce(new.copies, 0) < 0 or coalesce(new.size_bytes, 0) < 0 then
    raise exception 'order_file_values_must_be_non_negative' using errcode = '22023';
  end if;

  if new.color_pct is not null and (new.color_pct < 0 or new.color_pct > 100) then
    raise exception 'order_file_color_pct_out_of_range' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_order_file_insert on public.order_files;
create trigger trg_guard_order_file_insert
before insert on public.order_files
for each row
execute function public.guard_order_file_insert();

create or replace function public.guard_order_addon_insert()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order record;
begin
  if current_user is distinct from 'authenticated' then
    return new;
  end if;

  select id, order_source, customer_id
    into v_order
    from public.orders
   where id = new.order_id;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if public.is_staff_or_admin() then
    null;
  elsif v_order.order_source = 'online' and v_order.customer_id = auth.uid() then
    null;
  else
    raise exception 'order_addon_insert_not_allowed' using errcode = '42501';
  end if;

  if coalesce(new.quantity, 0) <= 0 then
    raise exception 'order_addon_quantity_must_be_positive' using errcode = '22023';
  end if;
  if coalesce(new.unit_price, 0) < 0 then
    raise exception 'order_addon_unit_price_must_be_non_negative' using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_order_addon_insert on public.order_addons;
create trigger trg_guard_order_addon_insert
before insert on public.order_addons
for each row
execute function public.guard_order_addon_insert();

create or replace function public.guard_walk_in_transaction_insert()
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

  raise exception 'walk_in_transaction_insert_requires_staff_or_admin' using errcode = '42501';
end;
$$;

drop trigger if exists trg_guard_walk_in_transaction_insert on public.walk_in_transactions;
create trigger trg_guard_walk_in_transaction_insert
before insert on public.walk_in_transactions
for each row
execute function public.guard_walk_in_transaction_insert();
