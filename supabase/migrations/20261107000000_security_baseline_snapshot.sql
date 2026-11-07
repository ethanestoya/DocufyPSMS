-- Security baseline: snapshot of the intended server-authoritative shape.
-- Applied before the RPC/guard migrations so every later change is additive.
--
-- 1. order_files gains the colour percentage the server prices from. The value
--    is still client-supplied metadata (the browser is the only file analyzer),
--    but it is now the single field the pricing RPC reads instead of trusting a
--    client-computed total.
-- 2. order_addons gains the inventory item reference, so the server can price
--    an add-on from `inventory_items.price` instead of trusting `unit_price`.

alter table public.order_files
  add column if not exists color_pct numeric(5, 2);

alter table public.order_addons
  add column if not exists inventory_item_id uuid;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'order_addons_inventory_item_id_fkey'
       and conrelid = 'public.order_addons'::regclass
  ) then
    alter table public.order_addons
      add constraint order_addons_inventory_item_id_fkey
      foreign key (inventory_item_id)
      references public.inventory_items(id)
      on delete set null;
  end if;
end
$$;

comment on column public.order_files.color_pct is
  'Percentage of the rendered pages containing colour, as measured by the client analyzer. Used by the server-side pricing helpers.';
comment on column public.order_addons.inventory_item_id is
  'Inventory item the add-on came from. When present the server prices from inventory_items.price.';
