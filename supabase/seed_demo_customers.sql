-- ============================================================================
-- Docufy PSMS — DEMO CUSTOMER SEED (automatic unclaimed-order / penalty system)
-- ----------------------------------------------------------------------------
-- Creates real, login-able Supabase Auth accounts — ONE PER FUNCTION of the
-- automatic unclaimed-order penalty system — plus the orders and status-history
-- timelines that make each function visible. Offenses are DERIVED live from the
-- authoritative orders + their order_status_history (see
-- src/app/utils/unclaimedOrders.ts and src/app/utils/unclaimedPolicy.ts). There
-- is no stored ledger and no review queue.
--
-- RUN THIS IN: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Run supabase/reset_demo_customers.sql FIRST to remove older demo data.
-- It is IDEMPOTENT — re-running updates the same rows instead of duplicating.
--
-- All demo logins share the password:  DocufyDemo123!
--
--   Account                          Function demonstrated
--   ---------------------------------------------------------------------------
--   no.unclaimed@docufy.demo         Level 0 — clean account, no warning
--   first.offense@docufy.demo        Level 1 — warning only, COP allowed
--   second.offense@docufy.demo       Level 2 — Cash on Pickup disabled
--   third.offense@docufy.demo        Level 3 — full advance required
--   collected.on.time@docufy.demo    Excluded  — collected before the deadline
--   collected.late@docufy.demo       Counted   — collected after the deadline
--   advance.paid@docufy.demo         Excluded  — advance / online paid
--   within.window@docufy.demo        Excluded  — pickup deadline has not passed
--
-- !! REQUIRED CONFIG: offenses are only computed once the shop's CLOSING TIME is
--    set (Admin -> Management -> Landing Page -> Shop Information -> "Closing
--    time", e.g. 20:00). Until then the derivation returns nothing and the admin
--    pages show "pickup deadline cannot be computed — configure shop hours".
--    These demo orders assume a 20:00 closing time.
--
-- !! TIMING NOTE: the within.window order is seeded as "just completed", so it
--    reads as still-in-window only while the current time is before the shop's
--    closing time. Seed/ demo during shop hours. The day-based accounts (first/
--    second/third offense, collected.*) are anchored to past dates and are
--    unaffected by when you run this.
--
-- NOTE: writing to the auth schema directly is version-sensitive. If your
-- project rejects it (permission/trigger error), create the users in
-- Dashboard -> Authentication -> Add user (email + password above), then run
-- only section 1b onwards; section 1a's `on conflict` makes it safe to re-run.
-- ============================================================================

create extension if not exists pgcrypto;


-- ============================================================================
-- SECTION 1a — AUTH USERS (real logins)
-- One account per function. uuid is fixed so re-running is idempotent.
-- ============================================================================

do $$
declare
  accounts constant text[][] := array[
    array['d0000001-0000-4000-8000-000000000000', 'no.unclaimed@docufy.demo'],
    array['d0000002-0000-4000-8000-000000000000', 'first.offense@docufy.demo'],
    array['d0000003-0000-4000-8000-000000000000', 'second.offense@docufy.demo'],
    array['d0000004-0000-4000-8000-000000000000', 'third.offense@docufy.demo'],
    array['d0000005-0000-4000-8000-000000000000', 'collected.on.time@docufy.demo'],
    array['d0000006-0000-4000-8000-000000000000', 'collected.late@docufy.demo'],
    array['d0000007-0000-4000-8000-000000000000', 'advance.paid@docufy.demo'],
    array['d0000008-0000-4000-8000-000000000000', 'within.window@docufy.demo']
  ];
  rec text[];
  uid uuid;
  em  text;
begin
  foreach rec slice 1 in array accounts
  loop
    uid := rec[1]::uuid;
    em  := rec[2];

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    )
    values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      em, crypt('DocufyDemo123!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', em),
      '', '', '', ''
    )
    on conflict (id) do update
      set email              = excluded.email,
          encrypted_password = excluded.encrypted_password,
          email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
          updated_at         = now();

    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id
    )
    values (
      uid::text, uid,
      jsonb_build_object('sub', uid::text, 'email', em),
      'email', now(), now(), now(), gen_random_uuid()
    )
    on conflict do nothing;

    raise notice 'demo seed: ensured auth user %', em;
  end loop;
exception when others then
  raise warning 'demo seed: auth user creation FAILED (%) — create them in the Dashboard instead', sqlerrm;
end $$;


-- ============================================================================
-- SECTION 1b — PROFILES
-- ============================================================================

do $$
declare
  accounts constant text[][] := array[
    array['d0000001-0000-4000-8000-000000000000', 'no.unclaimed@docufy.demo',      'Clean Account (No Unclaimed)'],
    array['d0000002-0000-4000-8000-000000000000', 'first.offense@docufy.demo',     'First Offense Customer'],
    array['d0000003-0000-4000-8000-000000000000', 'second.offense@docufy.demo',    'Second Offense Customer'],
    array['d0000004-0000-4000-8000-000000000000', 'third.offense@docufy.demo',     'Third Offense Customer'],
    array['d0000005-0000-4000-8000-000000000000', 'collected.on.time@docufy.demo', 'Collected On Time Customer'],
    array['d0000006-0000-4000-8000-000000000000', 'collected.late@docufy.demo',    'Collected Late Customer'],
    array['d0000007-0000-4000-8000-000000000000', 'advance.paid@docufy.demo',      'Advance Paid Customer'],
    array['d0000008-0000-4000-8000-000000000000', 'within.window@docufy.demo',     'Within Window Customer']
  ];
  rec text[];
begin
  foreach rec slice 1 in array accounts
  loop
    insert into public.profiles (id, email, full_name, role, created_at, updated_at)
    values (rec[1]::uuid, rec[2], rec[3], 'customer', now(), now())
    on conflict (id) do update
      set email = excluded.email, full_name = excluded.full_name, updated_at = now();
  end loop;
end $$;


-- ============================================================================
-- SECTION 2..5 — ORDERS + COST BREAKDOWNS + PAYMENTS + STATUS TIMELINE
-- All tied to '@docufy.demo' accounts. Timestamps are anchored to today's
-- Manila midnight (base0) minus N days, so the "days overdue" is stable.
--
--   no.unclaimed        (d1) no orders
--   first.offense       (d2) 1× COP completed, never collected   -> 1 offense
--   second.offense      (d3) 2× COP completed, never collected   -> 2 offenses
--   third.offense       (d4) 3× COP completed, never collected   -> 3 offenses
--   collected.on.time   (d5) 1× COP, released SAME day (<=20:00) -> excluded
--   collected.late      (d6) 1× COP, released NEXT day (after)   -> counted
--   advance.paid        (d7) 1× online-paid (GCash), not COP     -> excluded
--   within.window       (d8) 1× COP completed just now           -> not due yet
-- ============================================================================

do $$
declare
  base0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Manila')) at time zone 'Asia/Manila';
  d2  timestamptz := base0 - interval '2 days';
  d3  timestamptz := base0 - interval '3 days';
  d4  timestamptz := base0 - interval '4 days';
  d5  timestamptz := base0 - interval '5 days';
  d12 timestamptz := base0 - interval '12 days';
  d20 timestamptz := base0 - interval '20 days';
  cop text := 'Cash on Pickup: collect and pay at the shop.';
begin
  -- ------------------------------------------------------------------ ORDERS
  insert into public.orders (
    id, customer_id, customer_name, customer_email, status, order_source,
    subtotal, addons_total, total, manual_total, payment_amount_paid,
    hold_reason, notes, created_at, updated_at, status_updated_at
  ) values
    -- first.offense — 1 uncollected COP
    ('e0000001-0000-4000-8000-000000000000', 'd0000002-0000-4000-8000-000000000000', 'First Offense Customer',  'first.offense@docufy.demo',
     'Completed', 'online', 150, 0, 150, 150, 0, cop, 'DEMO — uncollected cash-on-pickup (Level 1).',
     d3 + time '10:00', d3 + time '10:00', d3 + time '10:00'),
    -- second.offense — 2 uncollected COP
    ('e0000002-0000-4000-8000-000000000000', 'd0000003-0000-4000-8000-000000000000', 'Second Offense Customer', 'second.offense@docufy.demo',
     'Completed', 'online', 200, 0, 200, 200, 0, cop, 'DEMO — uncollected cash-on-pickup (Level 2, #1).',
     d20 + time '10:00', d20 + time '10:00', d20 + time '10:00'),
    ('e0000003-0000-4000-8000-000000000000', 'd0000003-0000-4000-8000-000000000000', 'Second Offense Customer', 'second.offense@docufy.demo',
     'Completed', 'online', 200, 0, 200, 200, 0, cop, 'DEMO — uncollected cash-on-pickup (Level 2, #2).',
     d12 + time '10:00', d12 + time '10:00', d12 + time '10:00'),
    -- third.offense — 3 uncollected COP
    ('e0000004-0000-4000-8000-000000000000', 'd0000004-0000-4000-8000-000000000000', 'Third Offense Customer',  'third.offense@docufy.demo',
     'Completed', 'online', 150, 0, 150, 150, 0, cop, 'DEMO — uncollected cash-on-pickup (Level 3, #1).',
     d5 + time '10:00', d5 + time '10:00', d5 + time '10:00'),
    ('e0000005-0000-4000-8000-000000000000', 'd0000004-0000-4000-8000-000000000000', 'Third Offense Customer',  'third.offense@docufy.demo',
     'Completed', 'online', 150, 0, 150, 150, 0, cop, 'DEMO — uncollected cash-on-pickup (Level 3, #2).',
     d4 + time '10:00', d4 + time '10:00', d4 + time '10:00'),
    ('e0000006-0000-4000-8000-000000000000', 'd0000004-0000-4000-8000-000000000000', 'Third Offense Customer',  'third.offense@docufy.demo',
     'Completed', 'online', 150, 0, 150, 150, 0, cop, 'DEMO — uncollected cash-on-pickup (Level 3, #3).',
     d3 + time '10:00', d3 + time '10:00', d3 + time '10:00'),
    -- collected.on.time — COP collected BEFORE deadline (same day 15:00 < 20:00)
    ('e0000007-0000-4000-8000-000000000000', 'd0000005-0000-4000-8000-000000000000', 'Collected On Time Customer', 'collected.on.time@docufy.demo',
     'Released', 'online', 160, 0, 160, 160, 160, cop, 'DEMO — collected before the pickup deadline (excluded).',
     d4 + time '10:00', d4 + time '15:00', d4 + time '15:00'),
    -- collected.late — COP collected AFTER deadline (next day 09:00 > ready-day 20:00)
    ('e0000008-0000-4000-8000-000000000000', 'd0000006-0000-4000-8000-000000000000', 'Collected Late Customer', 'collected.late@docufy.demo',
     'Released', 'online', 220, 0, 220, 220, 220, cop, 'DEMO — collected after the pickup deadline (still counts).',
     d3 + time '10:00', d2 + time '09:00', d2 + time '09:00'),
    -- advance.paid — online paid, never COP (excluded)
    ('e0000009-0000-4000-8000-000000000000', 'd0000007-0000-4000-8000-000000000000', 'Advance Paid Customer', 'advance.paid@docufy.demo',
     'Completed', 'online', 300, 0, 300, 300, 300, null, 'DEMO — paid in advance online (never cash-on-pickup).',
     d5 + time '10:00', d5 + time '10:00', d5 + time '10:00'),
    -- within.window — completed just now; deadline not passed yet
    ('e0000010-0000-4000-8000-000000000000', 'd0000008-0000-4000-8000-000000000000', 'Within Window Customer', 'within.window@docufy.demo',
     'Completed', 'online', 180, 0, 180, 180, 0, cop, 'DEMO — just completed; pickup deadline not passed yet (excluded).',
     now(), now(), now())
  on conflict (id) do update set
    customer_id = excluded.customer_id, customer_name = excluded.customer_name,
    customer_email = excluded.customer_email, status = excluded.status, order_source = excluded.order_source,
    subtotal = excluded.subtotal, addons_total = excluded.addons_total, total = excluded.total,
    manual_total = excluded.manual_total, payment_amount_paid = excluded.payment_amount_paid,
    hold_reason = excluded.hold_reason, notes = excluded.notes,
    created_at = excluded.created_at, updated_at = excluded.updated_at, status_updated_at = excluded.status_updated_at;

  -- -------------------------------------------------------- COST BREAKDOWNS
  -- Real table (order_id PK, printing_cost, addons_cost, total). printing_cost +
  -- addons_cost must equal total; the demo orders have no add-ons.
  insert into public.order_cost_breakdowns (order_id, printing_cost, addons_cost, total)
  values
    ('e0000001-0000-4000-8000-000000000000', 150, 0, 150),
    ('e0000002-0000-4000-8000-000000000000', 200, 0, 200),
    ('e0000003-0000-4000-8000-000000000000', 200, 0, 200),
    ('e0000004-0000-4000-8000-000000000000', 150, 0, 150),
    ('e0000005-0000-4000-8000-000000000000', 150, 0, 150),
    ('e0000006-0000-4000-8000-000000000000', 150, 0, 150),
    ('e0000007-0000-4000-8000-000000000000', 160, 0, 160),
    ('e0000008-0000-4000-8000-000000000000', 220, 0, 220),
    ('e0000009-0000-4000-8000-000000000000', 300, 0, 300),
    ('e0000010-0000-4000-8000-000000000000', 180, 0, 180)
  on conflict (order_id) do update set
    printing_cost = excluded.printing_cost, addons_cost = excluded.addons_cost, total = excluded.total;

  -- --------------------------------------------------------------- PAYMENTS
  -- Only collected / advance-paid orders have a verified payment. Uncollected
  -- COP orders deliberately have NO payment row — they read as unpaid and their
  -- method resolves to "Cash" via the cash-on-pickup hold reason.
  insert into public.payments (id, order_id, method_name, amount, status, reference_number, submitted_at, verified_at, verified_by)
  values
    ('f0000001-0000-4000-8000-000000000000', 'e0000007-0000-4000-8000-000000000000', 'Cash',  160, 'verified', 'DEMO-ONTIME',  d4 + time '15:00', d4 + time '15:00', null),
    ('f0000002-0000-4000-8000-000000000000', 'e0000008-0000-4000-8000-000000000000', 'Cash',  220, 'verified', 'DEMO-LATE',    d2 + time '09:00', d2 + time '09:00', null),
    ('f0000003-0000-4000-8000-000000000000', 'e0000009-0000-4000-8000-000000000000', 'GCash', 300, 'verified', 'DEMO-ADVANCE', d5 + time '10:00', d5 + time '10:00', null)
  on conflict (id) do update set
    order_id = excluded.order_id, method_name = excluded.method_name, amount = excluded.amount,
    status = excluded.status, reference_number = excluded.reference_number,
    submitted_at = excluded.submitted_at, verified_at = excluded.verified_at;

  -- ------------------------------------------------------ STATUS TIMELINE
  -- Authoritative source the derivation reads. COP orders reach 'Completed'
  -- (ready) on their ready day; collected ones additionally show 'Released'.
  insert into public.order_status_history (id, order_id, old_status, new_status, reason, changed_by, created_at)
  values
    ('c0000001-0000-4000-8000-000000000000', 'e0000001-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d3 + time '10:00'),
    ('c0000002-0000-4000-8000-000000000000', 'e0000002-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d20 + time '10:00'),
    ('c0000003-0000-4000-8000-000000000000', 'e0000003-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d12 + time '10:00'),
    ('c0000004-0000-4000-8000-000000000000', 'e0000004-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d5 + time '10:00'),
    ('c0000005-0000-4000-8000-000000000000', 'e0000005-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d4 + time '10:00'),
    ('c0000006-0000-4000-8000-000000000000', 'e0000006-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d3 + time '10:00'),
    ('c0000007-0000-4000-8000-000000000000', 'e0000007-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d4 + time '10:00'),
    ('c0000008-0000-4000-8000-000000000000', 'e0000007-0000-4000-8000-000000000000', 'Completed', 'Released',  'DEMO collected before deadline', null, d4 + time '15:00'),
    ('c0000009-0000-4000-8000-000000000000', 'e0000008-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — cash on pickup',    null, d3 + time '10:00'),
    ('c0000010-0000-4000-8000-000000000000', 'e0000008-0000-4000-8000-000000000000', 'Completed', 'Released',  'DEMO collected after deadline',  null, d2 + time '09:00'),
    ('c0000011-0000-4000-8000-000000000000', 'e0000009-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — paid in advance',   null, d5 + time '10:00'),
    ('c0000012-0000-4000-8000-000000000000', 'e0000010-0000-4000-8000-000000000000', null,        'Completed', 'DEMO ready — just completed',    null, now())
  on conflict (id) do update set
    order_id = excluded.order_id, old_status = excluded.old_status, new_status = excluded.new_status,
    reason = excluded.reason, changed_by = excluded.changed_by, created_at = excluded.created_at;
end $$;


-- ============================================================================
-- SECTION 6 — SUMMARY
-- ============================================================================

select
  p.email,
  p.full_name,
  count(o.id)                                   as orders,
  count(o.id) filter (where o.status = 'Released') as released,
  count(o.id) filter (where o.hold_reason ilike '%Cash on Pickup%') as cash_on_pickup_orders
from public.profiles p
left join public.orders o on o.customer_id = p.id
where p.email like '%@docufy.demo'
group by p.email, p.full_name
order by p.email;
