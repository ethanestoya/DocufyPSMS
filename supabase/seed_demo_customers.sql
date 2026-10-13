-- ============================================================================
-- Docufy PSMS — DEMO CUSTOMER SEED (login-able accounts + demo orders)
-- ----------------------------------------------------------------------------
-- Creates real, login-able Supabase Auth accounts for the automatic UNCLAIMED
-- Cash-on-Pickup order system — offenses are DERIVED from the authoritative
-- orders + their order_status_history timeline (see
-- src/app/utils/unclaimedOrders.ts and src/app/utils/unclaimedPolicy.ts), not
-- from any stored ledger — plus the orders + status history that exercise every
-- rule. Nothing here is a "review queue": the pages recompute offenses live.
--
-- RUN THIS IN: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- It is IDEMPOTENT — re-running it updates the same accounts/rows instead of
-- duplicating them — so it is safe to run more than once.
--
-- IMPORTANT: after running, scroll to the results. Every account must appear in
-- the final SELECT, AND the "Messages" tab must show
--   "demo seed: ensured auth user <email>"
-- for every account. A WARNING naming an account means that login did NOT get
-- created (see the note at the top of each block for the manual fallback).
--
-- All demo logins share the password:  DocufyDemo123!
--
--   maria.santos@docufy.demo    1 unclaimed COP order  -> 1st offense (warning)
--   juan.delacruz@docufy.demo   1 unclaimed COP order  -> 1st offense (warning)
--   carlo.mendoza@docufy.demo   2 unclaimed COP orders -> 2nd offense (COP disabled)
--   ryan.cruz@docufy.demo       3 unclaimed COP orders -> 3rd+ offense (full advance)
--   pedro.lim@docufy.demo       advance-paid past deadline -> never counts
--   ana.reyes@docufy.demo       online-paid (Maya)        -> never counts
--   liza.torres@docufy.demo     collected before deadline  -> never counts
--
-- ALSO DEMONSTRATES (why a record does / doesn't count):
--   * Released BEFORE the pickup deadline (same day)   — excluded.
--   * Released AFTER the pickup deadline (next day)     — still counts.
--   * Advance / online-paid orders past the deadline     — never count.
--
-- !! REQUIRED CONFIG: an offense is only computed once the shop's CLOSING TIME
--    is configured (Admin -> Management -> Landing Page -> Shop Information ->
--    "Closing time", e.g. 20:00). Until then the derivation returns no offenses
--    and the admin pages show "pickup deadline cannot be computed — configure
--    shop hours". These demo orders assume a 20:00 closing time.
--
-- NOTE: writing to the auth schema directly is version-sensitive. This script
-- uses only long-stable columns, blanks every GoTrue "token" column (a NULL in
-- any of them makes GoTrue reject the login), and detects the newer
-- `identities.provider_id` schema. If an account still fails to create, make it
-- from Dashboard -> Authentication -> Users -> Add user (Auto Confirm User)
-- with the same email + password; the profile/orders rows below still seed.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── 1a. Auth users + email identities ───────────────────────────────────────
do $$
declare
  u record;
  v_has_provider_id boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'identities'
      and column_name = 'provider_id'
  ) into v_has_provider_id;

  for u in
    select * from (values
      ('11111111-1111-4111-8111-111111111111'::uuid, 'maria.santos@docufy.demo',  'Maria Santos',    'DocufyDemo123!'),
      ('22222222-2222-4222-8222-222222222222'::uuid, 'juan.delacruz@docufy.demo', 'Juan Dela Cruz',  'DocufyDemo123!'),
      ('33333333-3333-4333-8333-333333333333'::uuid, 'ana.reyes@docufy.demo',     'Ana Reyes',       'DocufyDemo123!'),
      ('44444444-4444-4444-8444-444444444444'::uuid, 'pedro.lim@docufy.demo',     'Pedro Lim',       'DocufyDemo123!'),
      ('55555555-5555-4555-8555-555555555555'::uuid, 'carlo.mendoza@docufy.demo', 'Carlo Mendoza',   'DocufyDemo123!'),
      ('66666666-6666-4666-8666-666666666666'::uuid, 'liza.torres@docufy.demo',   'Liza Torres',     'DocufyDemo123!'),
      ('77777777-7777-4777-8777-777777777777'::uuid, 'ryan.cruz@docufy.demo',     'Ryan Cruz',       'DocufyDemo123!')
    ) as t(uid, email, full_name, password)
  loop
    begin
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new,
        raw_app_meta_data, raw_user_meta_data
      ) values (
        '00000000-0000-0000-0000-000000000000', u.uid, 'authenticated', 'authenticated', u.email,
        crypt(u.password, gen_salt('bf')),
        now(), now(), now(),
        '', '', '', '',
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', u.full_name, 'email', u.email, 'demo', true)
      )
      on conflict (id) do update set
        email = excluded.email,
        encrypted_password = excluded.encrypted_password,
        email_confirmed_at = coalesce(auth.users.email_confirmed_at, now()),
        updated_at = now(),
        confirmation_token = '',
        recovery_token = '',
        email_change = '',
        email_change_token_new = '',
        raw_app_meta_data = excluded.raw_app_meta_data,
        raw_user_meta_data = excluded.raw_user_meta_data;

      -- Blank any OTHER token columns this GoTrue version ships (GoTrue reads
      -- them as non-null strings; a NULL makes sign-in fail with "invalid").
      execute (
        select 'update auth.users set ' ||
               string_agg(format('%I = coalesce(%I, %L)', column_name, column_name, ''), ', ') ||
               format(' where id = %L', u.uid)
        from information_schema.columns
        where table_schema = 'auth' and table_name = 'users'
          and column_name in (
            'confirmation_token', 'recovery_token', 'email_change',
            'email_change_token_new', 'email_change_token_current',
            'phone_change', 'phone_change_token', 'reauthentication_token'
          )
      );

      if v_has_provider_id then
        insert into auth.identities (
          provider_id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) values (
          u.uid::text, u.uid,
          jsonb_build_object('sub', u.uid::text, 'email', u.email),
          'email', now(), now(), now()
        )
        on conflict (provider_id, provider) do update set
          identity_data = excluded.identity_data,
          updated_at = now();
      else
        insert into auth.identities (
          id, user_id, identity_data, provider,
          last_sign_in_at, created_at, updated_at
        ) values (
          u.uid::text, u.uid,
          jsonb_build_object('sub', u.uid::text, 'email', u.email),
          'email', now(), now(), now()
        )
        on conflict (id) do update set
          identity_data = excluded.identity_data,
          updated_at = now();
      end if;

      raise notice 'demo seed: ensured auth user %', u.email;
    exception when others then
      raise warning 'demo seed: auth user % FAILED — %', u.email, sqlerrm;
    end;
  end loop;
end $$;

-- ── 1b. Profiles (separate block: a profile error cannot undo the login) ────
do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('11111111-1111-4111-8111-111111111111'::uuid, 'maria.santos@docufy.demo',  'Maria Santos'),
      ('22222222-2222-4222-8222-222222222222'::uuid, 'juan.delacruz@docufy.demo', 'Juan Dela Cruz'),
      ('33333333-3333-4333-8333-333333333333'::uuid, 'ana.reyes@docufy.demo',     'Ana Reyes'),
      ('44444444-4444-4444-8444-444444444444'::uuid, 'pedro.lim@docufy.demo',     'Pedro Lim'),
      ('55555555-5555-4555-8555-555555555555'::uuid, 'carlo.mendoza@docufy.demo', 'Carlo Mendoza'),
      ('66666666-6666-4666-8666-666666666666'::uuid, 'liza.torres@docufy.demo',   'Liza Torres'),
      ('77777777-7777-4777-8777-777777777777'::uuid, 'ryan.cruz@docufy.demo',     'Ryan Cruz')
    ) as t(uid, email, full_name)
  loop
    begin
      insert into public.profiles (id, full_name, role, email, active, suspended)
      values (u.uid, u.full_name, 'customer', u.email, true, false)
      on conflict (id) do update set
        full_name = excluded.full_name,
        role = 'customer',
        email = excluded.email,
        active = true,
        suspended = false,
        updated_at = now();

      raise notice 'demo seed: ensured profile %', u.email;
    exception when others then
      raise warning 'demo seed: profile % FAILED — %', u.email, sqlerrm;
    end;
  end loop;
end $$;

-- ── 2. Demo orders (one per scenario; two for the restricted customer) ───────
-- order_number is server-assigned, so it is never written here.
insert into public.orders (
  id, customer_id, customer_name, customer_email, status, order_source,
  subtotal, addons_total, total, manual_total, payment_amount_paid,
  notes, created_at, updated_at, status_updated_at
) values
  ('a1111111-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Maria Santos',  'maria.santos@docufy.demo',  'Completed', 'online', 180, 0, 180, 180, 180, 'DEMO SEED — Under Review (staff flagged).', now() - interval '2 days',  now() - interval '2 days',  now() - interval '2 days'),
  ('a2222222-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Juan Dela Cruz','juan.delacruz@docufy.demo', 'Completed', 'online', 240, 0, 240, 240, 240, 'DEMO SEED — Excuse Requested.',            now() - interval '3 days',  now() - interval '3 days',  now() - interval '3 days'),
  ('a3333333-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'Ana Reyes',     'ana.reyes@docufy.demo',     'Completed', 'online', 150, 0, 150, 150, 150, 'DEMO SEED — Confirmed Unclaimed.',         now() - interval '5 days',  now() - interval '5 days',  now() - interval '5 days'),
  ('a4444444-0000-4000-8000-000000000004', '44444444-4444-4444-8444-444444444444', 'Pedro Lim',     'pedro.lim@docufy.demo',     'Completed', 'online', 320, 0, 320, 320, 320, 'DEMO SEED — Excused.',                     now() - interval '6 days',  now() - interval '6 days',  now() - interval '6 days'),
  ('a5555555-0000-4000-8000-000000000005', '55555555-5555-4555-8555-555555555555', 'Carlo Mendoza', 'carlo.mendoza@docufy.demo', 'Completed', 'online', 200, 0, 200, 200, 200, 'DEMO SEED — Confirmed unclaimed (1st offence).', now() - interval '20 days', now() - interval '20 days', now() - interval '20 days'),
  ('a5555555-0000-4000-8000-000000000006', '55555555-5555-4555-8555-555555555555', 'Carlo Mendoza', 'carlo.mendoza@docufy.demo', 'Completed', 'online', 260, 0, 260, 260, 260, 'DEMO SEED — Confirmed unclaimed (2nd offence).', now() - interval '12 days', now() - interval '12 days', now() - interval '12 days'),
  ('a6666666-0000-4000-8000-000000000007', '66666666-6666-4666-8666-666666666666', 'Liza Torres',   'liza.torres@docufy.demo',   'Released',  'online', 120, 0, 120, 120, 120, 'DEMO SEED — Good standing (no incident).', now() - interval '1 day',   now() - interval '1 day',   now() - interval '1 day')
on conflict (id) do update set
  customer_id = excluded.customer_id,
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  status = excluded.status,
  order_source = excluded.order_source,
  subtotal = excluded.subtotal,
  addons_total = excluded.addons_total,
  total = excluded.total,
  manual_total = excluded.manual_total,
  payment_amount_paid = excluded.payment_amount_paid,
  notes = excluded.notes,
  updated_at = excluded.updated_at,
  status_updated_at = excluded.status_updated_at;

-- ── 3. Cost breakdowns (so Order Total renders from the matrix shape) ────────
insert into public.order_cost_breakdowns (order_id, printing_cost, addons_cost, total) values
  ('a1111111-0000-4000-8000-000000000001', 180, 0, 180),
  ('a2222222-0000-4000-8000-000000000002', 240, 0, 240),
  ('a3333333-0000-4000-8000-000000000003', 150, 0, 150),
  ('a4444444-0000-4000-8000-000000000004', 320, 0, 320),
  ('a5555555-0000-4000-8000-000000000005', 200, 0, 200),
  ('a5555555-0000-4000-8000-000000000006', 260, 0, 260),
  ('a6666666-0000-4000-8000-000000000007', 120, 0, 120)
on conflict (order_id) do update set
  printing_cost = excluded.printing_cost,
  addons_cost = excluded.addons_cost,
  total = excluded.total;

-- ── 4. Verified payments (so Payment & Balance reads "Paid") ─────────────────
insert into public.payments (
  id, order_id, method_name, amount, status, reference_number,
  submitted_at, verified_at, verified_by
) values
  ('b1111111-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000001', 'GCash', 180, 'verified', 'DEMO-MARIA',  now() - interval '2 days', now() - interval '2 days', null),
  ('b2222222-0000-4000-8000-000000000002', 'a2222222-0000-4000-8000-000000000002', 'GCash', 240, 'verified', 'DEMO-JUAN',   now() - interval '3 days', now() - interval '3 days', null),
  ('b3333333-0000-4000-8000-000000000003', 'a3333333-0000-4000-8000-000000000003', 'Maya',  150, 'verified', 'DEMO-ANA',    now() - interval '5 days', now() - interval '5 days', null),
  ('b4444444-0000-4000-8000-000000000004', 'a4444444-0000-4000-8000-000000000004', 'GCash', 320, 'verified', 'DEMO-PEDRO',  now() - interval '6 days', now() - interval '6 days', null),
  ('b5555555-0000-4000-8000-000000000005', 'a5555555-0000-4000-8000-000000000005', 'Cash',  200, 'verified', 'DEMO-CARLO1', now() - interval '20 days', now() - interval '20 days', null),
  ('b5555555-0000-4000-8000-000000000006', 'a5555555-0000-4000-8000-000000000006', 'Cash',  260, 'verified', 'DEMO-CARLO2', now() - interval '12 days', now() - interval '12 days', null),
  ('b6666666-0000-4000-8000-000000000007', 'a6666666-0000-4000-8000-000000000007', 'GCash', 120, 'verified', 'DEMO-LIZA',   now() - interval '1 day',  now() - interval '1 day',  null)
on conflict (id) do update set
  order_id = excluded.order_id,
  method_name = excluded.method_name,
  amount = excluded.amount,
  status = excluded.status,
  reference_number = excluded.reference_number,
  submitted_at = excluded.submitted_at,
  verified_at = excluded.verified_at;

-- ── 5. Unclaimed-order derivation scenarios ──────────────────────────────────
--     Orders + the order_status_history timeline that exercise every rule in
--     src/app/utils/unclaimedOrders.ts. These assume a 20:00 shop closing time.
--     Cash-on-Pickup orders past the deadline with no on-time Released count;
--     Released-before-deadline and advance/online-paid orders never count.
do $$
declare
  base0 timestamptz := date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
  d1  timestamptz := base0 - interval '1 day';
  d2  timestamptz := base0 - interval '2 days';
  d3  timestamptz := base0 - interval '3 days';
  d4  timestamptz := base0 - interval '4 days';
  d5  timestamptz := base0 - interval '5 days';
  d6  timestamptz := base0 - interval '6 days';
  d12 timestamptz := base0 - interval '12 days';
  d20 timestamptz := base0 - interval '20 days';
begin
  -- 5a. Orders (Cash-on-Pickup flagged via hold_reason; no payment row for the
  --     uncollected ones, since the customer never paid).
  insert into public.orders (
    id, customer_id, customer_name, customer_email, status, order_source,
    subtotal, addons_total, total, manual_total, payment_amount_paid,
    hold_reason, notes, created_at, updated_at, status_updated_at
  ) values
    -- Maria — 1 unclaimed Cash-on-Pickup order -> 1st offense (warning only).
    ('a7000001-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Maria Santos',  'maria.santos@docufy.demo',  'Completed', 'online', 150, 0, 150, 150, 0,   'Cash on Pickup: collect and pay at the shop.', 'DEMO SEED — unclaimed COP (counts).',              d3 + time '10:00', d3 + time '10:00', d3 + time '10:00'),
    -- Maria — collected BEFORE the deadline (same day at 15:30) -> EXCLUDED.
    ('a7000002-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Maria Santos',  'maria.santos@docufy.demo',  'Released',  'online', 160, 0, 160, 160, 160, 'Cash on Pickup: collect and pay at the shop.', 'DEMO SEED — released before deadline (excluded).',  d4 + time '10:00', d4 + time '15:30', d4 + time '15:30'),
    -- Juan — collected AFTER the deadline (next day at 09:00) -> STILL COUNTS.
    ('a7000003-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Juan Dela Cruz','juan.delacruz@docufy.demo', 'Released',  'online', 220, 0, 220, 220, 220, 'Cash on Pickup: collect and pay at the shop.', 'DEMO SEED — released after deadline (counts).',     d3 + time '10:00', d2 + time '09:00', d2 + time '09:00'),
    -- Ryan — 3 unclaimed COP orders -> 3rd+ offense (full advance required).
    ('a7000004-0000-4000-8000-000000000004', '77777777-7777-4777-8777-777777777777', 'Ryan Cruz',     'ryan.cruz@docufy.demo',     'Completed', 'online', 200, 0, 200, 200, 0,   'Cash on Pickup: collect and pay at the shop.', 'DEMO SEED — unclaimed COP #1 (counts).',            d5 + time '10:00', d5 + time '10:00', d5 + time '10:00'),
    ('a7000005-0000-4000-8000-000000000005', '77777777-7777-4777-8777-777777777777', 'Ryan Cruz',     'ryan.cruz@docufy.demo',     'Completed', 'online', 200, 0, 200, 200, 0,   'Cash on Pickup: collect and pay at the shop.', 'DEMO SEED — unclaimed COP #2 (counts).',            d4 + time '10:00', d4 + time '10:00', d4 + time '10:00'),
    ('a7000006-0000-4000-8000-000000000006', '77777777-7777-4777-8777-777777777777', 'Ryan Cruz',     'ryan.cruz@docufy.demo',     'Completed', 'online', 200, 0, 200, 200, 0,   'Cash on Pickup: collect and pay at the shop.', 'DEMO SEED — unclaimed COP #3 (counts).',            d3 + time '10:00', d3 + time '10:00', d3 + time '10:00'),
    -- Pedro — paid IN ADVANCE (GCash) past the deadline -> NEVER COUNTS.
    ('a7000007-0000-4000-8000-000000000007', '44444444-4444-4444-8444-444444444444', 'Pedro Lim',     'pedro.lim@docufy.demo',     'Completed', 'online', 300, 0, 300, 300, 300, null,                                           'DEMO SEED — advance-paid, never counts.',           d5 + time '10:00', d5 + time '10:00', d5 + time '10:00')
  on conflict (id) do update set
    customer_id = excluded.customer_id,
    customer_name = excluded.customer_name,
    customer_email = excluded.customer_email,
    status = excluded.status,
    order_source = excluded.order_source,
    subtotal = excluded.subtotal,
    addons_total = excluded.addons_total,
    total = excluded.total,
    manual_total = excluded.manual_total,
    payment_amount_paid = excluded.payment_amount_paid,
    hold_reason = excluded.hold_reason,
    notes = excluded.notes,
    updated_at = excluded.updated_at,
    status_updated_at = excluded.status_updated_at;

  -- 5b. Cost breakdowns for the new orders.
  insert into public.order_cost_breakdowns (order_id, printing_cost, addons_cost, total) values
    ('a7000001-0000-4000-8000-000000000001', 150, 0, 150),
    ('a7000002-0000-4000-8000-000000000002', 160, 0, 160),
    ('a7000003-0000-4000-8000-000000000003', 220, 0, 220),
    ('a7000004-0000-4000-8000-000000000004', 200, 0, 200),
    ('a7000005-0000-4000-8000-000000000005', 200, 0, 200),
    ('a7000006-0000-4000-8000-000000000006', 200, 0, 200),
    ('a7000007-0000-4000-8000-000000000007', 300, 0, 300)
  on conflict (order_id) do update set
    printing_cost = excluded.printing_cost,
    addons_cost = excluded.addons_cost,
    total = excluded.total;

  -- 5c. Payments for the COLLECTED / advance-paid orders only. The uncollected
  --     Cash-on-Pickup orders deliberately have NO payment row (their method is
  --     read from hold_reason), so they correctly read as unpaid.
  insert into public.payments (
    id, order_id, method_name, amount, status, reference_number,
    submitted_at, verified_at, verified_by
  ) values
    ('b7000001-0000-4000-8000-000000000001', 'a7000002-0000-4000-8000-000000000002', 'Cash',  160, 'verified', 'DEMO-MARIA2', d4 + time '15:30', d4 + time '15:30', null),
    ('b7000002-0000-4000-8000-000000000002', 'a7000003-0000-4000-8000-000000000003', 'Cash',  220, 'verified', 'DEMO-JUAN2',  d2 + time '09:00', d2 + time '09:00', null),
    ('b7000003-0000-4000-8000-000000000003', 'a7000007-0000-4000-8000-000000000007', 'GCash', 300, 'verified', 'DEMO-PEDRO2', d5 + time '10:00', d5 + time '10:00', null)
  on conflict (id) do update set
    order_id = excluded.order_id,
    method_name = excluded.method_name,
    amount = excluded.amount,
    status = excluded.status,
    reference_number = excluded.reference_number,
    submitted_at = excluded.submitted_at,
    verified_at = excluded.verified_at;

  -- 5d. Status timeline (only Completed / Released are used by the derivation).
  insert into public.order_status_history (id, order_id, old_status, new_status, reason, changed_by, created_at) values
    -- Existing demo orders — all reach Completed (ready for pickup).
    ('c7000001-0000-4000-8000-000000000001', 'a1111111-0000-4000-8000-000000000001', null,             'Completed', 'DEMO SEED', null, d2  + time '10:00'),
    ('c7000002-0000-4000-8000-000000000002', 'a2222222-0000-4000-8000-000000000002', null,             'Completed', 'DEMO SEED', null, d3  + time '10:00'),
    ('c7000003-0000-4000-8000-000000000003', 'a3333333-0000-4000-8000-000000000003', null,             'Completed', 'DEMO SEED', null, d5  + time '10:00'),
    ('c7000004-0000-4000-8000-000000000004', 'a4444444-0000-4000-8000-000000000004', null,             'Completed', 'DEMO SEED', null, d6  + time '10:00'),
    ('c7000005-0000-4000-8000-000000000005', 'a5555555-0000-4000-8000-000000000005', null,             'Completed', 'DEMO SEED', null, d20 + time '10:00'),
    ('c7000006-0000-4000-8000-000000000006', 'a5555555-0000-4000-8000-000000000006', null,             'Completed', 'DEMO SEED', null, d12 + time '10:00'),
    ('c7000007-0000-4000-8000-000000000007', 'a6666666-0000-4000-8000-000000000007', null,             'Completed', 'DEMO SEED', null, d1  + time '10:00'),
    ('c7000008-0000-4000-8000-000000000008', 'a6666666-0000-4000-8000-000000000007', 'Completed',      'Released',  'DEMO SEED', null, d1  + time '15:00'),
    -- New derivation scenarios.
    ('c7000009-0000-4000-8000-000000000009', 'a7000001-0000-4000-8000-000000000001', null,             'Completed', 'DEMO SEED', null, d3  + time '10:00'),
    ('c7000010-0000-4000-8000-000000000010', 'a7000002-0000-4000-8000-000000000002', null,             'Completed', 'DEMO SEED', null, d4  + time '10:00'),
    ('c7000011-0000-4000-8000-000000000011', 'a7000002-0000-4000-8000-000000000002', 'Completed',      'Released',  'DEMO SEED', null, d4  + time '15:30'),
    ('c7000012-0000-4000-8000-000000000012', 'a7000003-0000-4000-8000-000000000003', null,             'Completed', 'DEMO SEED', null, d3  + time '10:00'),
    ('c7000013-0000-4000-8000-000000000013', 'a7000003-0000-4000-8000-000000000003', 'Completed',      'Released',  'DEMO SEED', null, d2  + time '09:00'),
    ('c7000014-0000-4000-8000-000000000014', 'a7000004-0000-4000-8000-000000000004', null,             'Completed', 'DEMO SEED', null, d5  + time '10:00'),
    ('c7000015-0000-4000-8000-000000000015', 'a7000005-0000-4000-8000-000000000005', null,             'Completed', 'DEMO SEED', null, d4  + time '10:00'),
    ('c7000016-0000-4000-8000-000000000016', 'a7000006-0000-4000-8000-000000000006', null,             'Completed', 'DEMO SEED', null, d3  + time '10:00'),
    ('c7000017-0000-4000-8000-000000000017', 'a7000007-0000-4000-8000-000000000007', null,             'Completed', 'DEMO SEED', null, d5  + time '10:00')
  on conflict (id) do update set
    order_id = excluded.order_id,
    old_status = excluded.old_status,
    new_status = excluded.new_status,
    reason = excluded.reason,
    created_at = excluded.created_at;
end $$;

-- ── 6. Summary ───────────────────────────────────────────────────────────────
select p.email, p.full_name, p.role,
       (select count(*) from public.orders o where o.customer_id = p.id) as demo_orders
from public.profiles p
where p.email like '%@docufy.demo'
order by p.email;
