-- Money and quantity constraints that cannot be bypassed by the UI.

alter table public.orders
  add constraint orders_total_non_negative check (total >= 0),
  add constraint orders_manual_total_non_negative check (manual_total is null or manual_total >= 0),
  add constraint orders_payment_amount_paid_non_negative check (payment_amount_paid is null or payment_amount_paid >= 0),
  add constraint orders_down_payment_amount_non_negative check (down_payment_amount is null or down_payment_amount >= 0),
  add constraint orders_full_payment_amount_non_negative check (full_payment_amount is null or full_payment_amount >= 0);

alter table public.payments
  add constraint payments_amount_non_negative check (amount >= 0);

alter table public.order_files
  add constraint order_files_page_count_non_negative check (coalesce(page_count, 0) >= 0),
  add constraint order_files_copies_positive check (coalesce(copies, 1) > 0),
  add constraint order_files_size_bytes_non_negative check (coalesce(size_bytes, 0) >= 0),
  add constraint order_files_color_pct_range check (color_pct is null or (color_pct >= 0 and color_pct <= 100));

alter table public.order_addons
  add constraint order_addons_quantity_positive check (quantity > 0),
  add constraint order_addons_unit_price_non_negative check (unit_price >= 0);

alter table public.inventory_items
  add constraint inventory_items_stock_non_negative check (current_stock >= 0),
  add constraint inventory_items_min_stock_non_negative check (minimum_stock >= 0),
  add constraint inventory_items_price_non_negative check (price is null or price >= 0),
  add constraint inventory_items_pcs_per_unit_positive check (pcs_per_unit > 0);

alter table public.inventory_movements
  add constraint inventory_movements_quantity_positive check (quantity > 0);
