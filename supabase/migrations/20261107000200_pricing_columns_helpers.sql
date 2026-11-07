-- Server-side pricing helpers.
--
-- The browser remains the only place that can analyse a file, so it still sends
-- page counts / copies / colour percentage. What changes is that the SERVER now
-- derives the money from those measurements and the pricing matrix; the client
-- no longer decides the total it stores on the order.
--
-- The rules mirror `pricingStore.ts` / `PrintTransaction.tsx`:
--   * paper size  long | legal | folio -> 'long', short -> 'short', else 'a4'
--   * colour tier  bw when mode is bw or pct < 0.15 (the presence gate),
--                  partial up to 50%, mid up to 75% (average of partial and
--                  full), full above 75%
--   * photos     price per piece, quantity floor 1
--   * documents  rate x page_count x copies / pages_per_sheet
--   * add-ons    inventory_items.price when the item is referenced, else the
--                submitted unit price

create or replace function public.map_paper_size_key(p_size text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(nullif(p_size, ''), 'a4'))
           when 'long' then 'long'
           when 'legal' then 'long'
           when 'folio' then 'long'
           when 'short' then 'short'
           else 'a4'
         end;
$$;

create or replace function public.resolve_color_tier(p_color_mode text, p_color_pct numeric)
returns text
language sql
immutable
as $$
  select case
           when lower(coalesce(p_color_mode, 'bw')) = 'bw' then 'bw'
           when p_color_pct is null then 'bw'
           when p_color_pct < 0.15 then 'bw'
           when p_color_pct <= 50 then 'partial'
           when p_color_pct <= 75 then 'mid'
           else 'full'
         end;
$$;

create or replace function public.pricing_rate_for(
  p_service text,
  p_content text,
  p_tier text,
  p_size text,
  p_photo text
)
returns numeric
language sql
stable
as $$
  with matching as (
    select c.price, c.color_tier
      from public.pricing_matrix_cells c
     where c.service_type = p_service
       and (p_service <> 'document' or c.content_type = coalesce(nullif(p_content, ''), 'text'))
       and (
         (p_tier = 'mid' and c.color_tier in ('partial', 'full'))
         or (p_tier <> 'mid' and c.color_tier = p_tier)
       )
       and (p_service in ('sticker', 'photo') or c.paper_size = coalesce(nullif(p_size, ''), 'a4'))
       and (p_service <> 'photo' or c.photo_size = coalesce(nullif(p_photo, ''), 'A4photo'))
  )
  select case
           when p_tier = 'mid' then
             round(
               (coalesce(max(case when color_tier = 'partial' then price end), 0)
                + coalesce(max(case when color_tier = 'full' then price end), 0)) / 2.0
             )
           else coalesce(max(price), 0)
         end
    from matching;
$$;

create or replace function public.compute_order_totals(p_files jsonb, p_addons jsonb)
returns table (printing_cost numeric, addons_cost numeric, total numeric)
language plpgsql
stable
as $$
declare
  v_file jsonb;
  v_addon jsonb;
  v_print numeric := 0;
  v_add numeric := 0;
  v_service text;
  v_tier text;
  v_size text;
  v_content text;
  v_price numeric;
  v_pages integer;
  v_copies integer;
  v_pps integer;
  v_qty integer;
  v_item_price numeric;
begin
  for v_file in select value from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    v_service := lower(coalesce(nullif(v_file->>'printType', ''), 'document'));

    if v_service = 'photo' then
      select c.price
        into v_price
        from public.pricing_matrix_cells c
       where c.service_type = 'photo'
         and c.photo_size = coalesce(nullif(v_file->>'photoSize', ''), 'A4photo')
       limit 1;
      v_qty := greatest(1, coalesce(nullif(v_file->>'photoQuantity', '')::integer, 1));
      v_print := v_print + coalesce(v_price, 0) * v_qty;
    else
      v_tier := public.resolve_color_tier(v_file->>'colorMode', nullif(v_file->>'colorPct', '')::numeric);
      v_size := public.map_paper_size_key(v_file->>'paperSize');
      v_content := coalesce(nullif(v_file->>'contentType', ''), 'text');
      v_price := public.pricing_rate_for(v_service, v_content, v_tier, v_size, null);
      v_pages := greatest(0, coalesce(nullif(v_file->>'pageCount', '')::integer, 0));
      v_copies := greatest(1, coalesce(nullif(v_file->>'copies', '')::integer, 1));
      v_pps := greatest(1, coalesce(nullif(v_file->>'pagesPerSheet', '')::integer, 1));
      v_print := v_print + (coalesce(v_price, 0) * v_pages * v_copies) / v_pps;
    end if;
  end loop;

  for v_addon in select value from jsonb_array_elements(coalesce(p_addons, '[]'::jsonb)) loop
    v_qty := greatest(0, coalesce(nullif(v_addon->>'quantity', '')::integer, 1));
    v_item_price := null;
    if nullif(v_addon->>'inventoryItemId', '') is not null then
      select i.price
        into v_item_price
        from public.inventory_items i
       where i.id::text = v_addon->>'inventoryItemId'
       limit 1;
    end if;
    v_add := v_add
      + coalesce(v_item_price, nullif(v_addon->>'unitPrice', '')::numeric, 0) * v_qty;
  end loop;

  printing_cost := round(v_print, 2);
  addons_cost := round(v_add, 2);
  total := round(v_print + v_add, 2);
  return next;
end;
$$;

-- Expected paper consumption, grouped by paper size. Paper is still deducted
-- when the order is marked Completed, not at placement, so this only records
-- what completion should take out of inventory.
create or replace function public.compute_expected_paper_usage(p_files jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  v_file jsonb;
  v_map jsonb := '{}'::jsonb;
  v_service text;
  v_size text;
  v_pages integer;
  v_copies integer;
  v_pps integer;
  v_sheets integer;
begin
  for v_file in select value from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) loop
    v_service := lower(coalesce(nullif(v_file->>'printType', ''), 'document'));
    continue when v_service = 'photo';

    v_size := coalesce(nullif(v_file->>'paperSize', ''), 'a4');
    v_pages := greatest(0, coalesce(nullif(v_file->>'pageCount', '')::integer, 0));
    v_copies := greatest(1, coalesce(nullif(v_file->>'copies', '')::integer, 1));
    v_pps := greatest(1, coalesce(nullif(v_file->>'pagesPerSheet', '')::integer, 1));
    v_sheets := (ceil(v_pages::numeric / v_pps)::integer) * v_copies;

    if v_sheets > 0 then
      v_map := jsonb_set(
        v_map,
        array[v_size],
        to_jsonb(coalesce((v_map->>v_size)::integer, 0) + v_sheets),
        true
      );
    end if;
  end loop;

  return (
    select coalesce(
      jsonb_agg(jsonb_build_object('size', key, 'sheets', value::integer) order by key),
      '[]'::jsonb
    )
    from jsonb_each_text(v_map)
  );
end;
$$;
