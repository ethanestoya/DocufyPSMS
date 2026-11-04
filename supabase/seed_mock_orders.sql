-- ============================================================================
-- Docufy PSMS — MOCK ORDER DATA (Orders queue · Pickup Monitoring · Unclaimed)
-- ----------------------------------------------------------------------------
-- Inserts a realistic spread of orders so the three staff/admin surfaces are
-- populated, each with a FULL status timeline in `order_status_history`.
--
-- RUN THIS IN: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotent — re-running updates the same rows (no duplicates).
-- Remove everything with supabase/reset_mock_orders.sql.
--
-- WHY HISTORIES MATTER HERE: neither Pickup Monitoring nor Unclaimed Orders has
-- a stored "pickup state" or "offense" column. Both are DERIVED live from the
-- order + its order_status_history (src/app/utils/unclaimedOrders.ts, read by
-- PickupMonitoring.tsx and useUnclaimedOffenses.ts). So this seed writes the
-- timeline rows and lets the app do the maths — nothing is faked.
--
--   Derivation, exactly as the app runs it:
--     eligible  = order_source <> 'walkin'  AND  payment method resolves to Cash
--                 (for an online order with no payment row, the tell is
--                  hold_reason containing 'Cash on Pickup')
--     readyAt   = earliest history row with new_status = 'Completed'
--     deadline  = the shop CLOSING TIME on that same PHT day
--     offense   = now > deadline  AND  (never Released OR Released > deadline)
--     collected before the deadline  -> never an offense
--
-- !! REQUIRED CONFIG 1 — closing time. Offenses derive from nothing until the
--    shop has a closing time (Admin -> Management -> Landing Page -> Shop
--    Information -> "Closing time"). Section 0 below sets it to 20:00 ONLY when
--    it is currently blank; it never overwrites a value you configured. All
--    timestamps in this file assume 20:00, so use that or re-do the math.
--
-- !! REQUIRED CONFIG 2 — sign in as staff or admin and REFRESH before judging
--    the screens. The app reads business data through a Supabase-backed facade
--    over a localStorage mirror, so a session that hydrated before this run
--    will not show the new rows until it re-hydrates.
--
-- !! TIMING NOTE — the "ready today" orders (a4/a12) are Completed before 20:00
--    on purpose, so they read as Ready for pickup / Picked up only while it is
--    still before closing time in Manila. Run the demo during shop hours; the
--    day-anchored orders are unaffected.
--
-- !! PURGE GUARD — if the immediate-retention migration is applied and the
--    purge-expired-orders cron is live, any Released/Canceled order is deleted
--    from `orders` within about a minute. Section 9 un-queues this seed's own
--    rows inside the SAME transaction, so the worker can never see them.
--
-- WHAT EACH ROW DEMONSTRATES
--   a1  waiting.paying@   Orders — 'Awaiting Payment', nothing paid
--   a2  review.gcash@     Orders + Payment Verification — 'In Queue' on a PENDING
--                         GCash submission (no proof file on purpose)
--   a3  printing.now@     Orders — 'Printing', verified payment + an add-on line
--   a4  ready.today@      Pickup — 'Ready for pickup' (deadline not passed)
--   a5  overdue.one@      Pickup 'Overdue' + 1 offense  -> Level 1 warning only
--   a6  overdue.two@      2 offenses (a6 + a7)          -> Level 2, COP disabled
--   a8  overdue.three@    3 offenses (a8-a10)           -> Level 3, full advance
--   a11 late.pickup@      Pickup 'Picked up late' — collected after the deadline,
--                         so it still counts and lands in Unclaimed History
--   a12 ontime.pickup@    Pickup 'Picked up' — collected before the deadline,
--                         excluded from offenses
--   a13 paid.advance@     Completed long ago but ONLINE PAID -> no offense
--   a14 walkin.exempt@    walk-in, cash, overdue -> exempt (shows the exemption)
--   a15 canceled.order@   Orders — 'Canceled' with a reason
--   a16 excused.one@      2 offenses, ONE excused by an override -> counts as 1
--   a18 forgiven.pair@    2 offenses + an INACTIVE restriction -> forgiven early
--
-- All rows are scoped by the address suffix @docufy.mock and by the id prefix
-- 'a1'..'a7', and no auth account or profile is created (customer_id stays
-- null — every surface these pages use keys off the order's own
-- customer_name / customer_email). Real accounts are never touched.
-- ============================================================================

begin;


-- ============================================================================
-- SECTION 0 — PREREQUISITE: make sure a closing time exists (never overwrites)
-- ============================================================================

do $$
begin
  update public.landing_content
     set content = jsonb_set(
           coalesce(content, '{}'::jsonb),
           '{shopClosingTime}',
           '"20:00"'::jsonb
         )
   where id = true
     and coalesce(content ->> 'shopClosingTime', '') = '';

  if found then
    raise warning 'MOCK seed: shop closing time was blank, so it was set to 20:00 (the deadline this data assumes).';
  else
    raise notice 'MOCK seed: closing time already configured — left untouched.';
  end if;
exception
  when undefined_table then
    raise warning 'MOCK seed: public.landing_content is missing; set the closing time in the app before expecting offenses.';
end $$;


-- ============================================================================
-- SECTIONS 1-7 — THE DATA (one block so the timestamps can be shared)
-- ============================================================================

do $$
declare
  base0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Manila')) at time zone 'Asia/Manila';
  d1  timestamptz := base0 - interval '1 day';
  d2  timestamptz := base0 - interval '2 days';
  d3  timestamptz := base0 - interval '3 days';
  d4  timestamptz := base0 - interval '4 days';
  d5  timestamptz := base0 - interval '5 days';
  d6  timestamptz := base0 - interval '6 days';
  d7  timestamptz := base0 - interval '7 days';
  cop text := 'Cash on Pickup: collect and pay at the shop.';
begin

  -- ------------------------------------------------------------------ ORDERS
  insert into public.orders (
    id, customer_name, customer_email, status, order_source, customer_type,
    subtotal, addons_total, total, manual_total, payment_amount_paid,
    hold_reason, cancellation_reason, notes,
    created_at, updated_at, status_updated_at
  ) values
    -- a1 — sits in the Orders queue before any payment
    ('a1000001-0000-4000-8000-000000000000', 'Ana Torres', 'waiting.paying@docufy.mock',
     'Awaiting Payment', 'online', 'printing', 480, 0, 480, 480, 0, null, null,
     'MOCK — placed, payment still outstanding.',
     base0 + time '09:00', base0 + time '09:00', base0 + time '09:00'),
    -- a2 — pending GCash submission, so Payment Verification has something to review
    ('a1000002-0000-4000-8000-000000000000', 'Ben Ramos', 'review.gcash@docufy.mock',
     'In Queue', 'online', 'printing', 260, 0, 260, 260, 260, null, null,
     'MOCK — GCash proof awaiting staff verification.',
     d1 + time '16:00', base0 + time '08:20', base0 + time '08:20'),
    -- a3 — mid-print with a verified payment and one add-on
    ('a1000003-0000-4000-8000-000000000000', 'Carla Mendoza', 'printing.now@docufy.mock',
     'Printing', 'online', 'printing', 600, 40, 640, 640, 640, null, null,
     'MOCK — paid in advance, currently on the printer.',
     d1 + time '10:00', base0 + time '08:40', base0 + time '08:40'),
    -- a4 — READY TODAY: Pickup shows "Ready for pickup", no offense yet
    ('a1000004-0000-4000-8000-000000000000', 'Dan Villanueva', 'ready.today@docufy.mock',
     'Completed', 'online', 'photocopy', 150, 0, 150, 150, 0, cop, null,
     'MOCK — ready before closing time, so the deadline has not passed.',
     d1 + time '09:00', base0 + time '11:00', base0 + time '11:00'),
    -- a5 — ONE uncollected cash-on-pickup order (Level 1 = warning only)
    ('a1000005-0000-4000-8000-000000000000', 'Elena Garcia', 'overdue.one@docufy.mock',
     'Completed', 'online', 'printing', 180, 0, 180, 180, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 1 of 1).',
     d4 + time '09:00', d2 + time '11:00', d2 + time '11:00'),
    -- a6 + a7 — TWO offenses for one customer (Level 2 = Cash on Pickup disabled)
    ('a1000006-0000-4000-8000-000000000000', 'Ferdinand Cruz', 'overdue.two@docufy.mock',
     'Completed', 'online', 'printing', 150, 0, 150, 150, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 1 of 2).',
     d5 + time '09:00', d3 + time '10:00', d3 + time '10:00'),
    ('a1000007-0000-4000-8000-000000000000', 'Ferdinand Cruz', 'overdue.two@docufy.mock',
     'Completed', 'online', 'photo', 320, 0, 320, 320, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 2 of 2).',
     d3 + time '09:00', d1 + time '09:30', d1 + time '09:30'),
    -- a8 + a9 + a10 — THREE offenses (Level 3 = full advance required)
    ('a1000008-0000-4000-8000-000000000000', 'Grace Aquino', 'overdue.three@docufy.mock',
     'Completed', 'online', 'printing', 200, 0, 200, 200, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 1 of 3).',
     d7 + time '09:00', d5 + time '10:00', d5 + time '10:00'),
    ('a1000009-0000-4000-8000-000000000000', 'Grace Aquino', 'overdue.three@docufy.mock',
     'Completed', 'online', 'printing', 240, 0, 240, 240, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 2 of 3).',
     d6 + time '09:00', d4 + time '10:00', d4 + time '10:00'),
    ('a1000010-0000-4000-8000-000000000000', 'Grace Aquino', 'overdue.three@docufy.mock',
     'Completed', 'online', 'photocopy', 120, 0, 120, 120, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 3 of 3).',
     d5 + time '09:00', d2 + time '10:00', d2 + time '10:00'),
    -- a11 — collected the morning AFTER closing -> "Picked up late", still an offense
    ('a1000011-0000-4000-8000-000000000000', 'Hank Dela Cruz', 'late.pickup@docufy.mock',
     'Released', 'online', 'printing', 220, 0, 220, 220, 220, cop, null,
     'MOCK — collected after the pickup deadline (counts, and is in history).',
     d5 + time '09:00', d2 + time '09:00', d2 + time '09:00'),
    -- a12 — collected the same afternoon, before closing -> excluded
    ('a1000012-0000-4000-8000-000000000000', 'Ivy Salvador', 'ontime.pickup@docufy.mock',
     'Released', 'online', 'printing', 160, 0, 160, 160, 160, cop, null,
     'MOCK — collected before the pickup deadline (excluded from offenses).',
     d2 + time '09:00', base0 + time '15:00', base0 + time '15:00'),
    -- a13 — old, completed, but paid online in advance -> never an offense
    ('a1000013-0000-4000-8000-000000000000', 'Joseph Tan', 'paid.advance@docufy.mock',
     'Completed', 'online', 'printing', 900, 0, 900, 900, 900, null, null,
     'MOCK — paid in full through GCash, so cash-on-pickup rules do not apply.',
     d4 + time '10:00', d2 + time '10:00', d2 + time '10:00'),
    -- a14 — walk-in: cash, overdue, but exempt from the offense policy
    ('a1000014-0000-4000-8000-000000000000', 'Walk-in Customer (mock)', 'walkin.exempt@docufy.mock',
     'Completed', 'walkin', 'photocopy', 200, 0, 200, 200, 200, null, null,
     'MOCK — walk-in sale; exempt from unclaimed-order offenses.',
     d2 + time '11:00', d2 + time '13:00', d2 + time '13:00'),
    -- a15 — canceled, so the Orders queue has that status represented too
    ('a1000015-0000-4000-8000-000000000000', 'Lina Alfonso', 'canceled.order@docufy.mock',
     'Canceled', 'online', 'printing', 550, 0, 550, 550, 0, null,
     'MOCK — customer changed mind before printing.',
     'MOCK — cancelled, so the Orders queue shows that status too.',
     d5 + time '15:00', d4 + time '10:00', d4 + time '10:00'),
    -- a16 + a17 — two offenses, but a16 carries an EXCUSED override -> counts as 1
    ('a1000016-0000-4000-8000-000000000000', 'Mark Rivera', 'excused.one@docufy.mock',
     'Completed', 'online', 'printing', 190, 0, 190, 190, 0, cop, null,
     'MOCK — overdue, then excused by an admin override (does not count).',
     d5 + time '09:00', d3 + time '10:00', d3 + time '10:00'),
    ('a1000017-0000-4000-8000-000000000000', 'Mark Rivera', 'excused.one@docufy.mock',
     'Completed', 'online', 'printing', 210, 0, 210, 210, 0, cop, null,
     'MOCK — overdue and confirmed (the single offense that remains).',
     d4 + time '09:00', d2 + time '10:00', d2 + time '10:00'),
    -- a18 + a19 — two real offenses, forgiven early by an INACTIVE restriction
    ('a1000018-0000-4000-8000-000000000000', 'Nina Bugtong', 'forgiven.pair@docufy.mock',
     'Completed', 'online', 'printing', 170, 0, 170, 170, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 1 of 2).',
     d7 + time '09:00', d5 + time '10:00', d5 + time '10:00'),
    ('a1000019-0000-4000-8000-000000000000', 'Nina Bugtong', 'forgiven.pair@docufy.mock',
     'Completed', 'online', 'printing', 230, 0, 230, 230, 0, cop, null,
     'MOCK — overdue cash-on-pickup (offense 2 of 2).',
     d5 + time '09:00', d3 + time '10:00', d3 + time '10:00')
  on conflict (id) do update set
    customer_name = excluded.customer_name, customer_email = excluded.customer_email,
    status = excluded.status, order_source = excluded.order_source,
    customer_type = excluded.customer_type, subtotal = excluded.subtotal,
    addons_total = excluded.addons_total, total = excluded.total,
    manual_total = excluded.manual_total, payment_amount_paid = excluded.payment_amount_paid,
    hold_reason = excluded.hold_reason, cancellation_reason = excluded.cancellation_reason,
    notes = excluded.notes, created_at = excluded.created_at,
    updated_at = excluded.updated_at, status_updated_at = excluded.status_updated_at;

  -- ------------------------------------------------------------- ORDER FILES
  -- storage_path stays NULL: the file name and specs render, and no signed
  -- Storage URL is ever requested for a document that was never uploaded.
  insert into public.order_files (
    id, order_id, storage_path, original_name, mime_type, size_bytes, page_count,
    print_type, content_type, paper_size, copies, color_mode, orientation,
    photo_size, photo_quantity, notes, created_at
  ) values
    ('a2000001-0000-4000-8000-000000000000', 'a1000001-0000-4000-8000-000000000000', null,
     'thesis-chapter-3.pdf', 'application/pdf', 1843200, 42, 'document', 'text', 'A4', 2, 'bw',
     'portrait', null, null, 'MOCK file', d2 + time '20:30'),
    ('a2000002-0000-4000-8000-000000000000', 'a1000002-0000-4000-8000-000000000000', null,
     'board-resolution.pdf', 'application/pdf', 512000, 6, 'document', 'text', 'A4', 5, 'bw',
     'portrait', null, null, 'MOCK file', d2 + time '15:00'),
    ('a2000003-0000-4000-8000-000000000000', 'a1000003-0000-4000-8000-000000000000', null,
     'event-poster-final.pdf', 'application/pdf', 4400000, 2, 'document', 'mixed', 'A3', 20, 'colored',
     'portrait', null, null, 'MOCK file', d2 + time '10:00'),
    ('a2000004-0000-4000-8000-000000000000', 'a1000004-0000-4000-8000-000000000000', null,
     'module-1-reviewer.pdf', 'application/pdf', 980000, 24, 'document', 'text', 'Letter', 3, 'bw',
     'portrait', null, null, 'MOCK file', d3 + time '09:00'),
    ('a2000005-0000-4000-8000-000000000000', 'a1000005-0000-4000-8000-000000000000', null,
     'hr-manual-excerpt.pdf', 'application/pdf', 760000, 18, 'document', 'mixed', 'A4', 1, 'colored',
     'portrait', null, null, 'MOCK file', d4 + time '08:45'),
    ('a2000006-0000-4000-8000-000000000000', 'a1000006-0000-4000-8000-000000000000', null,
     'attendance-forms.pdf', 'application/pdf', 240000, 8, 'document', 'text', 'A4', 2, 'bw',
     'portrait', null, null, 'MOCK file', d5 + time '08:50'),
    ('a2000007-0000-4000-8000-000000000000', 'a1000007-0000-4000-8000-000000000000', null,
     'id-photos-batch.jpg', 'image/jpeg', 1500000, 1, 'photo', 'photo', null, 1, 'colored',
     null, '4R', 20, 'MOCK file', d3 + time '08:55'),
    ('a2000008-0000-4000-8000-000000000000', 'a1000008-0000-4000-8000-000000000000', null,
     'research-instrument.pdf', 'application/pdf', 620000, 12, 'document', 'text', 'A4', 4, 'bw',
     'portrait', null, null, 'MOCK file', d7 + time '08:40'),
    ('a2000009-0000-4000-8000-000000000000', 'a1000009-0000-4000-8000-000000000000', null,
     'syllabus-2nd-sem.pdf', 'application/pdf', 410000, 9, 'document', 'text', 'A4', 6, 'bw',
     'portrait', null, null, 'MOCK file', d6 + time '08:35'),
    ('a2000010-0000-4000-8000-000000000000', 'a1000010-0000-4000-8000-000000000000', null,
     'class-roster-copy.pdf', 'application/pdf', 120000, 2, 'photocopy', 'text', 'A4', 1, 'bw',
     'portrait', null, null, 'MOCK file', d5 + time '08:30'),
    ('a2000011-0000-4000-8000-000000000000', 'a1000011-0000-4000-8000-000000000000', null,
     'barangay-clearance.pdf', 'application/pdf', 210000, 3, 'document', 'text', 'A4', 4, 'bw',
     'portrait', null, null, 'MOCK file', d5 + time '08:55'),
    ('a2000012-0000-4000-8000-000000000000', 'a1000012-0000-4000-8000-000000000000', null,
     'certificate-of-enrollment.pdf', 'application/pdf', 95000, 1, 'document', 'text', 'A4', 2, 'bw',
     'portrait', null, null, 'MOCK file', d2 + time '08:40'),
    ('a2000013-0000-4000-8000-000000000000', 'a1000013-0000-4000-8000-000000000000', null,
     'company-profile-print.pdf', 'application/pdf', 8600000, 60, 'document', 'mixed', 'A4', 1, 'colored',
     'portrait', null, null, 'MOCK file', d4 + time '09:55'),
    ('a2000014-0000-4000-8000-000000000000', 'a1000014-0000-4000-8000-000000000000', null,
     'walkin-photocopy-batch.pdf', 'application/pdf', 350000, 35, 'photocopy', 'text', 'A4', 1, 'bw',
     'portrait', null, null, 'MOCK file', d2 + time '11:00'),
    ('a2000015-0000-4000-8000-000000000000', 'a1000015-0000-4000-8000-000000000000', null,
     'draft-proposal-v1.pdf', 'application/pdf', 1250000, 30, 'document', 'text', 'A4', 1, 'bw',
     'portrait', null, null, 'MOCK file', d5 + time '14:50'),
    ('a2000016-0000-4000-8000-000000000000', 'a1000016-0000-4000-8000-000000000000', null,
     'training-certificates.pdf', 'application/pdf', 540000, 5, 'document', 'mixed', 'A4', 2, 'colored',
     'portrait', null, null, 'MOCK file', d5 + time '08:50'),
    ('a2000017-0000-4000-8000-000000000000', 'a1000017-0000-4000-8000-000000000000', null,
     'project-appendix.pdf', 'application/pdf', 700000, 16, 'document', 'text', 'A4', 3, 'bw',
     'portrait', null, null, 'MOCK file', d4 + time '08:45'),
    ('a2000018-0000-4000-8000-000000000000', 'a1000018-0000-4000-8000-000000000000', null,
     'permission-slips.pdf', 'application/pdf', 180000, 4, 'document', 'text', 'A4', 10, 'bw',
     'portrait', null, null, 'MOCK file', d7 + time '08:45'),
    ('a2000019-0000-4000-8000-000000000000', 'a1000019-0000-4000-8000-000000000000', null,
     'reading-materials.pdf', 'application/pdf', 1020000, 28, 'document', 'text', 'A4', 2, 'bw',
     'portrait', null, null, 'MOCK file', d5 + time '08:40')
  on conflict (id) do update set
    order_id = excluded.order_id, storage_path = excluded.storage_path,
    original_name = excluded.original_name, mime_type = excluded.mime_type,
    size_bytes = excluded.size_bytes, page_count = excluded.page_count,
    print_type = excluded.print_type, content_type = excluded.content_type,
    paper_size = excluded.paper_size, copies = excluded.copies,
    color_mode = excluded.color_mode, orientation = excluded.orientation,
    photo_size = excluded.photo_size, photo_quantity = excluded.photo_quantity,
    notes = excluded.notes, created_at = excluded.created_at;

  -- ------------------------------------------------------------ ORDER ADDONS
  insert into public.order_addons (id, order_id, name, quantity, unit_price)
  values
    ('a3000001-0000-4000-8000-000000000000', 'a1000003-0000-4000-8000-000000000000', 'Spiral binding', 2, 20)
  on conflict (id) do update set
    order_id = excluded.order_id, name = excluded.name,
    quantity = excluded.quantity, unit_price = excluded.unit_price;

  -- -------------------------------------------------------- COST BREAKDOWNS
  -- printing_cost + addons_cost must equal total.
  insert into public.order_cost_breakdowns (order_id, printing_cost, addons_cost, total)
  values
    ('a1000001-0000-4000-8000-000000000000', 480, 0, 480),
    ('a1000002-0000-4000-8000-000000000000', 260, 0, 260),
    ('a1000003-0000-4000-8000-000000000000', 600, 40, 640),
    ('a1000004-0000-4000-8000-000000000000', 150, 0, 150),
    ('a1000005-0000-4000-8000-000000000000', 180, 0, 180),
    ('a1000006-0000-4000-8000-000000000000', 150, 0, 150),
    ('a1000007-0000-4000-8000-000000000000', 320, 0, 320),
    ('a1000008-0000-4000-8000-000000000000', 200, 0, 200),
    ('a1000009-0000-4000-8000-000000000000', 240, 0, 240),
    ('a1000010-0000-4000-8000-000000000000', 120, 0, 120),
    ('a1000011-0000-4000-8000-000000000000', 220, 0, 220),
    ('a1000012-0000-4000-8000-000000000000', 160, 0, 160),
    ('a1000013-0000-4000-8000-000000000000', 900, 0, 900),
    ('a1000014-0000-4000-8000-000000000000', 200, 0, 200),
    ('a1000015-0000-4000-8000-000000000000', 550, 0, 550),
    ('a1000016-0000-4000-8000-000000000000', 190, 0, 190),
    ('a1000017-0000-4000-8000-000000000000', 210, 0, 210),
    ('a1000018-0000-4000-8000-000000000000', 170, 0, 170),
    ('a1000019-0000-4000-8000-000000000000', 230, 0, 230)
  on conflict (order_id) do update set
    printing_cost = excluded.printing_cost, addons_cost = excluded.addons_cost,
    total = excluded.total;

  -- --------------------------------------------------------------- PAYMENTS
  -- An uncollected cash-on-pickup order deliberately has NO payment row — it
  -- must read as unpaid, with the method resolving to "Cash" through the
  -- hold_reason. Only genuinely paid orders get a row.
  insert into public.payments (
    id, order_id, method_name, amount, status, reference_number,
    submitted_at, verified_at
  ) values
    ('a4000001-0000-4000-8000-000000000000', 'a1000002-0000-4000-8000-000000000000', 'GCash', 260, 'pending',
     'MOCK-PEND-0002', base0 + time '08:10', null),
    ('a4000002-0000-4000-8000-000000000000', 'a1000003-0000-4000-8000-000000000000', 'GCash', 640, 'verified',
     'MOCK-VER-0003', d1 + time '10:40', d1 + time '11:00'),
    ('a4000003-0000-4000-8000-000000000000', 'a1000011-0000-4000-8000-000000000000', 'Cash', 220, 'verified',
     'MOCK-CASH-0011', d2 + time '09:00', d2 + time '09:00'),
    ('a4000004-0000-4000-8000-000000000000', 'a1000012-0000-4000-8000-000000000000', 'Cash', 160, 'verified',
     'MOCK-CASH-0012', base0 + time '15:00', base0 + time '15:00'),
    ('a4000005-0000-4000-8000-000000000000', 'a1000013-0000-4000-8000-000000000000', 'GCash', 900, 'verified',
     'MOCK-ADV-0013', d4 + time '10:20', d4 + time '10:30'),
    ('a4000006-0000-4000-8000-000000000000', 'a1000015-0000-4000-8000-000000000000', 'GCash', 550, 'canceled',
     'MOCK-CANCEL-015', d5 + time '15:30', null)
  on conflict (id) do update set
    order_id = excluded.order_id, method_name = excluded.method_name,
    amount = excluded.amount, status = excluded.status,
    reference_number = excluded.reference_number, submitted_at = excluded.submitted_at,
    verified_at = excluded.verified_at;

  -- ------------------------------------------------------ STATUS TIMELINE
  -- The authoritative source both Pickup Monitoring and Unclaimed Orders read.
  -- Every order walks its real lifecycle, so the derivation has something to
  -- work with and Order Details shows a believable history.
  insert into public.order_status_history (id, order_id, old_status, new_status, reason, changed_by, created_at)
  values
    -- a1 — placed only
    ('a5000001-0000-4000-8000-000000000000', 'a1000001-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, base0 + time '09:00'),
    -- a2 — placed, then queued on a pending submission
    ('a5000002-0000-4000-8000-000000000000', 'a1000002-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d1 + time '16:00'),
    ('a5000003-0000-4000-8000-000000000000', 'a1000002-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — payment reference submitted, awaiting verification.', null, base0 + time '08:20'),
    -- a3 — placed, queued, now printing
    ('a5000004-0000-4000-8000-000000000000', 'a1000003-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d1 + time '10:00'),
    ('a5000005-0000-4000-8000-000000000000', 'a1000003-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — GCash payment verified.', null, d1 + time '11:00'),
    ('a5000006-0000-4000-8000-000000000000', 'a1000003-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, base0 + time '08:40'),
    -- a4 — ready TODAY at 11:00 (deadline 20:00 today, not passed)
    ('a5000007-0000-4000-8000-000000000000', 'a1000004-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d1 + time '09:00'),
    ('a5000008-0000-4000-8000-000000000000', 'a1000004-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d1 + time '13:00'),
    ('a5000009-0000-4000-8000-000000000000', 'a1000004-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d1 + time '15:00'),
    ('a5000010-0000-4000-8000-000000000000', 'a1000004-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, base0 + time '11:00'),
    -- a5 — ready 2 days ago, never collected (1 offense)
    ('a5000011-0000-4000-8000-000000000000', 'a1000005-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d4 + time '09:00'),
    ('a5000012-0000-4000-8000-000000000000', 'a1000005-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d4 + time '14:00'),
    ('a5000013-0000-4000-8000-000000000000', 'a1000005-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d3 + time '09:00'),
    ('a5000014-0000-4000-8000-000000000000', 'a1000005-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d2 + time '11:00'),
    -- a6 — ready 3 days ago (offense 1 of 2)
    ('a5000015-0000-4000-8000-000000000000', 'a1000006-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d5 + time '09:00'),
    ('a5000016-0000-4000-8000-000000000000', 'a1000006-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d5 + time '12:00'),
    ('a5000017-0000-4000-8000-000000000000', 'a1000006-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d4 + time '09:00'),
    ('a5000018-0000-4000-8000-000000000000', 'a1000006-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d3 + time '10:00'),
    -- a7 — ready yesterday (offense 2 of 2)
    ('a5000019-0000-4000-8000-000000000000', 'a1000007-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d3 + time '09:00'),
    ('a5000020-0000-4000-8000-000000000000', 'a1000007-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d2 + time '10:00'),
    ('a5000021-0000-4000-8000-000000000000', 'a1000007-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d1 + time '08:00'),
    ('a5000022-0000-4000-8000-000000000000', 'a1000007-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — photo prints ready, cash on pickup.', null, d1 + time '09:30'),
    -- a8 — ready 5 days ago (offense 1 of 3)
    ('a5000023-0000-4000-8000-000000000000', 'a1000008-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d7 + time '09:00'),
    ('a5000024-0000-4000-8000-000000000000', 'a1000008-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d7 + time '13:00'),
    ('a5000025-0000-4000-8000-000000000000', 'a1000008-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d6 + time '09:00'),
    ('a5000026-0000-4000-8000-000000000000', 'a1000008-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d5 + time '10:00'),
    -- a9 — ready 4 days ago (offense 2 of 3)
    ('a5000027-0000-4000-8000-000000000000', 'a1000009-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d6 + time '09:00'),
    ('a5000028-0000-4000-8000-000000000000', 'a1000009-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d6 + time '13:00'),
    ('a5000029-0000-4000-8000-000000000000', 'a1000009-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d5 + time '09:00'),
    ('a5000030-0000-4000-8000-000000000000', 'a1000009-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d4 + time '10:00'),
    -- a10 — ready 2 days ago (offense 3 of 3)
    ('a5000031-0000-4000-8000-000000000000', 'a1000010-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d5 + time '09:00'),
    ('a5000032-0000-4000-8000-000000000000', 'a1000010-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d5 + time '13:00'),
    ('a5000033-0000-4000-8000-000000000000', 'a1000010-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d3 + time '09:00'),
    ('a5000034-0000-4000-8000-000000000000', 'a1000010-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d2 + time '10:00'),
    -- a11 — ready 6pm on d3 (deadline d3 20:00), collected 9am the NEXT morning -> LATE
    ('a5000035-0000-4000-8000-000000000000', 'a1000011-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d5 + time '09:00'),
    ('a5000036-0000-4000-8000-000000000000', 'a1000011-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d5 + time '13:00'),
    ('a5000037-0000-4000-8000-000000000000', 'a1000011-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d4 + time '09:00'),
    ('a5000038-0000-4000-8000-000000000000', 'a1000011-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready near closing time, cash on pickup.', null, d3 + time '18:00'),
    ('a5000039-0000-4000-8000-000000000000', 'a1000011-0000-4000-8000-000000000000', 'Completed', 'Released',
     'MOCK — collected the next morning, after the deadline.', null, d2 + time '09:00'),
    -- a12 — ready 9am and collected 3pm the SAME day -> ON TIME
    ('a5000040-0000-4000-8000-000000000000', 'a1000012-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d2 + time '09:00'),
    ('a5000041-0000-4000-8000-000000000000', 'a1000012-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d2 + time '13:00'),
    ('a5000042-0000-4000-8000-000000000000', 'a1000012-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, base0 + time '08:00'),
    ('a5000043-0000-4000-8000-000000000000', 'a1000012-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, base0 + time '09:00'),
    ('a5000044-0000-4000-8000-000000000000', 'a1000012-0000-4000-8000-000000000000', 'Completed', 'Released',
     'MOCK — collected before closing time.', null, base0 + time '15:00'),
    -- a13 — paid online in advance, so it is not a cash-on-pickup order
    ('a5000045-0000-4000-8000-000000000000', 'a1000013-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d4 + time '10:00'),
    ('a5000046-0000-4000-8000-000000000000', 'a1000013-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — paid in full through GCash.', null, d4 + time '10:30'),
    ('a5000047-0000-4000-8000-000000000000', 'a1000013-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d3 + time '09:00'),
    ('a5000048-0000-4000-8000-000000000000', 'a1000013-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, already paid online.', null, d2 + time '10:00'),
    -- a14 — walk-in, ready 2 days ago; exempt from the offense policy
    ('a5000049-0000-4000-8000-000000000000', 'a1000014-0000-4000-8000-000000000000', null, 'In Queue',
     'MOCK — walk-in request accepted at the counter.', null, d2 + time '11:00'),
    ('a5000050-0000-4000-8000-000000000000', 'a1000014-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d2 + time '12:00'),
    ('a5000051-0000-4000-8000-000000000000', 'a1000014-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — walk-in job finished, not collected.', null, d2 + time '13:00'),
    -- a15 — placed then canceled
    ('a5000052-0000-4000-8000-000000000000', 'a1000015-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d5 + time '15:00'),
    ('a5000053-0000-4000-8000-000000000000', 'a1000015-0000-4000-8000-000000000000', 'Awaiting Payment', 'Canceled',
     'MOCK — customer cancelled before printing.', null, d4 + time '10:00'),
    -- a16 — ready 3 days ago; an override below excuses this one
    ('a5000054-0000-4000-8000-000000000000', 'a1000016-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d5 + time '09:00'),
    ('a5000055-0000-4000-8000-000000000000', 'a1000016-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d5 + time '13:00'),
    ('a5000056-0000-4000-8000-000000000000', 'a1000016-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d4 + time '09:00'),
    ('a5000057-0000-4000-8000-000000000000', 'a1000016-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d3 + time '10:00'),
    -- a17 — ready 2 days ago; stays counted
    ('a5000058-0000-4000-8000-000000000000', 'a1000017-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d4 + time '09:00'),
    ('a5000059-0000-4000-8000-000000000000', 'a1000017-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d4 + time '13:00'),
    ('a5000060-0000-4000-8000-000000000000', 'a1000017-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d3 + time '09:00'),
    ('a5000061-0000-4000-8000-000000000000', 'a1000017-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d2 + time '10:00'),
    -- a18 — ready 5 days ago (offense 1 of 2, forgiven by an inactive restriction)
    ('a5000062-0000-4000-8000-000000000000', 'a1000018-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d7 + time '09:00'),
    ('a5000063-0000-4000-8000-000000000000', 'a1000018-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d7 + time '13:00'),
    ('a5000064-0000-4000-8000-000000000000', 'a1000018-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d6 + time '09:00'),
    ('a5000065-0000-4000-8000-000000000000', 'a1000018-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d5 + time '10:00'),
    -- a19 — ready 3 days ago (offense 2 of 2)
    ('a5000066-0000-4000-8000-000000000000', 'a1000019-0000-4000-8000-000000000000', null, 'Awaiting Payment',
     'MOCK — order placed online.', null, d5 + time '09:00'),
    ('a5000067-0000-4000-8000-000000000000', 'a1000019-0000-4000-8000-000000000000', 'Awaiting Payment', 'In Queue',
     'MOCK — queued with cash on pickup.', null, d5 + time '13:00'),
    ('a5000068-0000-4000-8000-000000000000', 'a1000019-0000-4000-8000-000000000000', 'In Queue', 'Printing',
     'MOCK — started printing.', null, d4 + time '09:00'),
    ('a5000069-0000-4000-8000-000000000000', 'a1000019-0000-4000-8000-000000000000', 'Printing', 'Completed',
     'MOCK — ready for pickup, cash on pickup.', null, d3 + time '10:00')
  on conflict (id) do update set
    order_id = excluded.order_id, old_status = excluded.old_status,
    new_status = excluded.new_status, reason = excluded.reason,
    changed_by = excluded.changed_by, created_at = excluded.created_at;

  -- ------------------------------------------------- WALK-IN TRANSACTION LOG
  insert into public.walk_in_transactions (
    id, order_id, customer_name, customer_type, total, payment_method, created_at
  ) values
    ('a7000001-0000-4000-8000-000000000000', 'a1000014-0000-4000-8000-000000000000',
     'Walk-in Customer (mock)', 'photocopy', 200, 'Cash', d2 + time '13:00')
  on conflict (id) do update set
    order_id = excluded.order_id, customer_name = excluded.customer_name,
    customer_type = excluded.customer_type, total = excluded.total,
    payment_method = excluded.payment_method, created_at = excluded.created_at;

  -- ----------------------------------------------------------- NOTIFICATIONS
  -- Role-targeted rows for the staff/admin bell. If your project's notification
  -- policy only matches recipient_profile_id, these simply stay invisible — they
  -- are a bonus, not part of what Orders / Pickup / Unclaimed read.
  insert into public.notifications (
    id, notification_type, priority, title, message,
    recipient_role, related_order_id, related_route, clickable, created_at
  ) values
    ('a6000001-0000-4000-8000-000000000000', 'pickup_overdue', 'important',
     'Order overdue for pickup',
     'MOCK — Elena Garcia''s cash-on-pickup order passed its pickup deadline.',
     'staff', 'a1000005-0000-4000-8000-000000000000', '/staff/queue/pickup', true, d2 + time '20:05'),
    ('a6000002-0000-4000-8000-000000000000', 'unclaimed_repeated', 'important',
     'Customer reached 3 uncollected orders',
     'MOCK — Grace Aquino now owes full advance before Cash on Pickup returns.',
     'admin', 'a1000010-0000-4000-8000-000000000000', '/admin/orders/unclaimed/restrictions', true, d2 + time '20:05'),
    ('a6000003-0000-4000-8000-000000000000', 'payment_pending', 'regular',
     'Payment awaiting verification',
     'MOCK — Ben Ramos submitted a GCash reference for a queued order.',
     'staff', 'a1000002-0000-4000-8000-000000000000', '/staff/payment-verification', true, base0 + time '08:15'),
    ('a6000004-0000-4000-8000-000000000000', 'printing_started', 'regular',
     'Order moved to Printing',
     'MOCK — Carla Mendoza''s posters are on the printer.',
     'staff', 'a1000003-0000-4000-8000-000000000000', '/staff/queue', true, base0 + time '08:45'),
    ('a6000005-0000-4000-8000-000000000000', 'pickup_late', 'regular',
     'Late pickup recorded',
     'MOCK — Hank Dela Cruz collected an order after the deadline.',
     'admin', 'a1000011-0000-4000-8000-000000000000', '/admin/orders/unclaimed/history', true, d2 + time '09:05')
  on conflict (id) do update set
    notification_type = excluded.notification_type, priority = excluded.priority,
    title = excluded.title, message = excluded.message, recipient_role = excluded.recipient_role,
    related_order_id = excluded.related_order_id, related_route = excluded.related_route,
    clickable = excluded.clickable, created_at = excluded.created_at;

end $$;


-- ============================================================================
-- SECTION 8 — THE ADMIN LAYER (excusals + restrictions)
-- ----------------------------------------------------------------------------
-- These two tables back the human decisions on top of the derivation. They are
-- staff/admin-only (RLS: public.is_staff_or_admin()), so customers read nothing
-- here. If the tables do not exist in your project the block skips itself.
-- ============================================================================

do $$
begin
  -- One derived offense the admin explicitly chose NOT to count.
  insert into public.unclaimed_offense_overrides (
    order_id, customer_key, decision, reason, decided_by, decided_by_name, decided_at
  ) values
    ('a1000016-0000-4000-8000-000000000000', 'excused.one@docufy.mock', 'excused',
     'MOCK — customer was out of the country; admin excused this one.',
     null, 'Demo Admin', now())
  on conflict (order_id) do update set
    customer_key = excluded.customer_key, decision = excluded.decision,
    reason = excluded.reason, decided_by_name = excluded.decided_by_name,
    decided_at = excluded.decided_at;

  -- Active restrictions, materialized as the app would have created them.
  insert into public.customer_restrictions (
    customer_key, customer_name, customer_email, active, arrangement,
    reason, removed_reason, set_by, set_by_name, set_at, updated_at
  ) values
    ('overdue.two@docufy.mock', 'Ferdinand Cruz', 'overdue.two@docufy.mock', true, 'deposit_50',
     'MOCK — 2 uncollected cash-on-pickup orders; 50% deposit required.',
     null, null, 'Demo Admin', now(), now()),
    ('overdue.three@docufy.mock', 'Grace Aquino', 'overdue.three@docufy.mock', true, 'full_advance',
     'MOCK — 3 uncollected cash-on-pickup orders; full advance required.',
     null, null, 'Demo Admin', now(), now()),
    -- INACTIVE row = explicit early forgiveness: Cash on Pickup comes back even
    -- though the derived count is still 2.
    ('forgiven.pair@docufy.mock', 'Nina Bugtong', 'forgiven.pair@docufy.mock', false, 'deposit_50',
     'MOCK — 2 uncollected cash-on-pickup orders.',
     'MOCK — forgiven early after the customer settled the first order.',
     null, 'Demo Admin', now() - interval '1 day', now())
  on conflict (customer_key) do update set
    customer_name = excluded.customer_name, customer_email = excluded.customer_email,
    active = excluded.active, arrangement = excluded.arrangement,
    reason = excluded.reason, removed_reason = excluded.removed_reason,
    set_by_name = excluded.set_by_name, set_at = excluded.set_at,
    updated_at = excluded.updated_at;
exception
  when undefined_table then
    raise warning 'MOCK seed: unclaimed_offense_overrides / customer_restrictions are not present in this project — skipped. Orders, Pickup Monitoring and Unclaimed still work.';
  when others then
    raise warning 'MOCK seed: the admin-layer rows (excusals / restrictions) were skipped: %', sqlerrm;
end $$;


-- ============================================================================
-- SECTION 9 — RETENTION-PURGE GUARD (must stay in the same transaction)
-- ----------------------------------------------------------------------------
-- The immediate-retention trigger queues every Released/Canceled order for the
-- purge-expired-orders worker, which would delete this seed's rows within about
-- a minute. Their queue entries are removed here, before COMMIT, so no other
-- session can ever see them. Real orders are untouched — the delete is scoped to
-- @docufy.mock.
-- ============================================================================

do $$
begin
  delete from public.order_retention_queue
   where order_id in (
     select id from public.orders where customer_email like '%@docufy.mock'
   );
exception
  when undefined_table then
    raise notice 'MOCK seed: order_retention_queue does not exist (retention migration not applied) — nothing to guard.';
end $$;

commit;


-- ============================================================================
-- SECTION 10 — WHAT TO EXPECT
-- ----------------------------------------------------------------------------
-- Re-implements the app's rule in SQL (20:00 closing, PHT days) so you can
-- confirm the data before opening the screens. One line per mock order; the
-- `verdict` column says what Unclaimed Orders should do with it.
-- ============================================================================

select
  o.customer_email,
  o.status,
  m.method                                                    as payment_method,
  to_char(r.ready_at at time zone 'Asia/Manila', 'MM-DD HH24:MI')           as ready_at,
  to_char(d.deadline_at, 'MM-DD HH24:MI')                                   as pickup_deadline,
  coalesce(to_char(rel.released_at at time zone 'Asia/Manila', 'MM-DD HH24:MI'), '—') as released_at,
  case
    when o.order_source = 'walkin' then 'excluded — walk-in'
    when lower(coalesce(m.method, '')) <> 'cash'
      then 'excluded — not cash on pickup (' || coalesce(m.method, 'no method') || ')'
    when r.ready_at is null then 'not ready — no offense possible'
    when rel.released_at is not null and rel.released_at <= d.deadline_at
      then 'collected on time — excluded'
    when rel.released_at is not null then 'OFFENSE — collected late'
    when now() <= d.deadline_at then 'in window — not due yet'
    else 'OFFENSE — uncollected'
  end as verdict
from public.orders o
left join lateral (
  -- Same resolution the app uses (dataStore.orderDtoToApp): the latest payment's
  -- method, else Cash for walk-ins, else Cash when hold_reason says pickup.
  select coalesce(
    (select p.method_name from public.payments p
      where p.order_id = o.id
      order by p.submitted_at desc nulls last, p.id desc limit 1),
    case when o.order_source = 'walkin' then 'Cash' end,
    case when o.hold_reason like '%Cash on Pickup%' then 'Cash' end
  ) as method
) m on true
left join lateral (
  select min(h.created_at) as ready_at
  from public.order_status_history h
  where h.order_id = o.id and h.new_status = 'Completed'
) r on true
left join lateral (
  select (date_trunc('day', r.ready_at at time zone 'Asia/Manila') at time zone 'Asia/Manila')
         + time '20:00' as deadline_at
) d on true
left join lateral (
  select min(h.created_at) as released_at
  from public.order_status_history h
  where h.order_id = o.id and h.new_status = 'Released'
) rel on true
where o.customer_email like '%@docufy.mock'
order by o.customer_email, r.ready_at;
