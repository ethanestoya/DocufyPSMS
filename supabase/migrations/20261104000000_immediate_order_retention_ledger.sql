create table if not exists public.released_order_transactions (
  archived_order_id uuid primary key,
  order_number bigint not null unique,
  customer_id uuid,
  customer_name text not null,
  customer_email text,
  order_source text not null,
  customer_type text,
  service_category text not null,
  subtotal numeric not null,
  printing_cost numeric not null,
  addons_cost numeric not null,
  total numeric not null,
  amount_paid numeric not null,
  balance numeric not null,
  payment_status text not null,
  payment_method text not null,
  payment_reference_number text,
  payment_details jsonb not null default '[]'::jsonb,
  status_history jsonb not null default '[]'::jsonb,
  transaction_number bigint,
  placed_at timestamptz not null,
  released_at timestamptz not null,
  archived_at timestamptz not null default now()
);

alter table public.released_order_transactions
  add column if not exists status_history jsonb not null default '[]'::jsonb;

create index if not exists released_order_transactions_released_at_idx
  on public.released_order_transactions (released_at desc);

alter table public.released_order_transactions enable row level security;

drop policy if exists "Staff and admins can read released transactions"
  on public.released_order_transactions;
create policy "Staff and admins can read released transactions"
  on public.released_order_transactions
  for select
  to authenticated
  using (public.is_staff_or_admin());

drop policy if exists "Customers can read own released transactions"
  on public.released_order_transactions;
create policy "Customers can read own released transactions"
  on public.released_order_transactions
  for select
  to authenticated
  using (
    customer_id = (select auth.uid())
    or (
      coalesce(auth.jwt() ->> 'email', '') <> ''
      and lower(coalesce(customer_email, '')) =
        lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

revoke all on public.released_order_transactions from public, anon, authenticated;
grant select on public.released_order_transactions to authenticated;

create table if not exists public.order_retention_queue (
  order_id uuid primary key,
  terminal_status text not null check (terminal_status in ('Released', 'Canceled')),
  enqueued_at timestamptz not null default now(),
  attempts integer not null default 0,
  locked_until timestamptz,
  last_error text
);

create index if not exists order_retention_queue_ready_idx
  on public.order_retention_queue (locked_until, enqueued_at);

alter table public.order_retention_queue enable row level security;
revoke all on public.order_retention_queue from anon, authenticated;
grant all on public.order_retention_queue to service_role;

create or replace function public.set_order_status_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at := pg_catalog.now();
  end if;
  return new;
end;
$$;

drop trigger if exists orders_set_status_updated_at on public.orders;
create trigger orders_set_status_updated_at
before update of status on public.orders
for each row
execute function public.set_order_status_updated_at();

create or replace function public.capture_released_order_transaction(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  with order_snapshot as (
    select
      o.id,
      o.order_number,
      o.customer_id,
      o.customer_name,
      nullif(btrim(o.customer_email), '') as customer_email,
      o.order_source::text as order_source,
      o.customer_type,
      o.subtotal,
      o.addons_total,
      o.manual_total,
      o.total,
      o.down_payment_required,
      o.down_payment_amount,
      o.down_payment_verified,
      o.full_payment_required,
      o.full_payment_verified,
      o.created_at,
      o.status_updated_at as released_at,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('status', history.status, 'at', history.status_at)
          order by history.status_at
        )
        from (
          select h.new_status::text as status, h.created_at as status_at
          from public.order_status_history h
          where h.order_id = o.id
          union all
          select 'Released', o.status_updated_at
          where not exists (
            select 1
            from public.order_status_history h
            where h.order_id = o.id
              and h.new_status = 'Released'
          )
        ) history
      ), '[]'::jsonb) as status_history,
      coalesce(cb.printing_cost, greatest(
        coalesce(o.manual_total, o.total) -
        coalesce(
          cb.addons_cost,
          (select coalesce(sum(a.quantity * a.unit_price), 0)
           from public.order_addons a
           where a.order_id = o.id),
          o.addons_total,
          0
        ),
        0
      )) as printing_cost,
      coalesce(
        cb.addons_cost,
        (select coalesce(sum(a.quantity * a.unit_price), 0)
         from public.order_addons a
         where a.order_id = o.id),
        o.addons_total,
        0
      ) as addons_cost,
      coalesce(cb.total, o.manual_total, o.total) as effective_total,
      first_file.print_type,
      first_file.color_mode,
      first_file.created_at as first_file_created_at,
      exists (
        select 1
        from public.order_addons a
        where a.order_id = o.id
      ) as has_addons
    from public.orders o
    left join public.order_cost_breakdowns cb on cb.order_id = o.id
    left join lateral (
      select f.print_type, f.color_mode, f.created_at
      from public.order_files f
      where f.order_id = o.id
      order by f.created_at, f.id
      limit 1
    ) first_file on true
    where o.id = p_order_id
      and o.status = 'Released'
  ),
  payment_snapshot as (
    select
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'amount', p.amount,
            'method', p.method_name,
            'status', p.status::text,
            'reference_number', p.reference_number,
            'submitted_at', p.submitted_at,
            'verified_at', p.verified_at
          )
          order by p.submitted_at, p.id
        ),
        '[]'::jsonb
      ) as details,
      (array_agg(p.method_name order by p.submitted_at desc, p.id desc))[1] as latest_method,
      (array_agg(p.reference_number order by p.submitted_at desc, p.id desc))[1] as latest_reference,
      (array_agg(p.status::text order by p.submitted_at desc, p.id desc))[1] as latest_status,
      coalesce(sum(p.amount) filter (where p.status = 'verified'), 0) as verified_amount
    from public.payments p
    where p.order_id = p_order_id
  ),
  financial_snapshot as (
    select
      s.*,
      p.details as payment_details,
      p.latest_method,
      p.latest_reference,
      p.latest_status,
      least(
        s.effective_total,
        greatest(
          p.verified_amount,
          case
            when s.full_payment_required and s.full_payment_verified
              then s.effective_total
            when s.down_payment_required and s.down_payment_verified
              then least(coalesce(s.down_payment_amount, 0), s.effective_total)
            else 0
          end
        )
      ) as amount_paid
    from order_snapshot s
    cross join payment_snapshot p
  ),
  walk_in_snapshot as (
    select w.transaction_number, w.payment_method
    from public.walk_in_transactions w
    where w.order_id = p_order_id
    order by w.created_at desc, w.transaction_number desc
    limit 1
  )
  insert into public.released_order_transactions (
    archived_order_id,
    order_number,
    customer_id,
    customer_name,
    customer_email,
    order_source,
    customer_type,
    service_category,
    subtotal,
    printing_cost,
    addons_cost,
    total,
    amount_paid,
    balance,
    payment_status,
    payment_method,
    payment_reference_number,
    payment_details,
    status_history,
    transaction_number,
    placed_at,
    released_at
  )
  select
    s.id,
    s.order_number,
    s.customer_id,
    s.customer_name,
    s.customer_email,
    s.order_source,
    s.customer_type,
    case
      when s.customer_type = 'photocopy'
        or lower(coalesce(s.print_type, '')) like '%photocopy%'
        then 'Photocopy'
      when lower(coalesce(s.print_type, '')) like '%photo%'
        then 'Photo Printing'
      when lower(coalesce(s.color_mode, '')) = 'bw'
        or lower(coalesce(s.print_type, '')) like '%bw%'
        or lower(coalesce(s.print_type, '')) like '%black%'
        then 'Black & White Printing'
      when lower(coalesce(s.color_mode, '')) = 'color'
        or lower(coalesce(s.print_type, '')) like '%color%'
        or lower(coalesce(s.print_type, '')) like '%coloured%'
        then 'Colored Printing'
      when s.has_addons then 'School Supplies'
      else 'Others'
    end,
    s.subtotal,
    s.printing_cost,
    s.addons_cost,
    s.effective_total,
    s.amount_paid,
    greatest(s.effective_total - s.amount_paid, 0),
    case
      when s.amount_paid >= s.effective_total then 'Paid'
      when s.amount_paid > 0 then 'Partially Paid'
      when s.latest_status = 'pending' and s.latest_reference is not null
        then 'Pending Verification'
      when s.latest_status is not null then initcap(s.latest_status)
      else 'Payment Due'
    end,
    coalesce(
      w.payment_method,
      s.latest_method,
      case when s.order_source = 'walkin' then 'Cash' else 'Online' end
    ),
    s.latest_reference,
    s.payment_details,
    s.status_history,
    w.transaction_number,
    s.created_at,
    s.released_at
  from financial_snapshot s
  left join walk_in_snapshot w on true
  on conflict (archived_order_id) do update set
    order_number = excluded.order_number,
    customer_id = excluded.customer_id,
    customer_name = excluded.customer_name,
    customer_email = excluded.customer_email,
    order_source = excluded.order_source,
    customer_type = excluded.customer_type,
    service_category = excluded.service_category,
    subtotal = excluded.subtotal,
    printing_cost = excluded.printing_cost,
    addons_cost = excluded.addons_cost,
    total = excluded.total,
    amount_paid = excluded.amount_paid,
    balance = excluded.balance,
    payment_status = excluded.payment_status,
    payment_method = excluded.payment_method,
    payment_reference_number = excluded.payment_reference_number,
    payment_details = excluded.payment_details,
    status_history = excluded.status_history,
    transaction_number = excluded.transaction_number,
    placed_at = excluded.placed_at,
    released_at = excluded.released_at;
$$;

revoke all on function public.capture_released_order_transaction(uuid)
  from public, anon, authenticated;
grant execute on function public.capture_released_order_transaction(uuid)
  to service_role;

create or replace function public.claim_order_retention_jobs(p_limit integer default 50)
returns table (order_id uuid, terminal_status text)
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select q.order_id
    from public.order_retention_queue q
    where q.locked_until is null or q.locked_until <= pg_catalog.now()
    order by q.enqueued_at, q.order_id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ),
  claimed as (
    update public.order_retention_queue q
    set
      locked_until = pg_catalog.now() + interval '10 minutes',
      attempts = q.attempts + 1
    from candidates c
    where q.order_id = c.order_id
    returning q.order_id, q.terminal_status
  )
  select c.order_id, c.terminal_status
  from claimed c;
$$;

create or replace function public.release_order_retention_job(
  p_order_id uuid,
  p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.order_retention_queue
  set
    locked_until = null,
    last_error = left(coalesce(p_error, 'Unknown cleanup error'), 2000)
  where order_id = p_order_id;
$$;

revoke all on function public.claim_order_retention_jobs(integer)
  from public, anon, authenticated;
revoke all on function public.release_order_retention_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_order_retention_jobs(integer)
  to service_role;
grant execute on function public.release_order_retention_job(uuid, text)
  to service_role;

create or replace function public.enqueue_terminal_order_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'Released' then
    perform public.capture_released_order_transaction(new.id);
  else
    delete from public.released_order_transactions
    where archived_order_id = new.id;
  end if;

  if new.status in ('Released', 'Canceled') then
    insert into public.order_retention_queue (
      order_id,
      terminal_status,
      enqueued_at,
      attempts,
      locked_until,
      last_error
    )
    values (new.id, new.status::text, pg_catalog.now(), 0, null, null)
    on conflict (order_id) do update
      set terminal_status = excluded.terminal_status,
          enqueued_at = excluded.enqueued_at,
          attempts = 0,
          locked_until = null,
          last_error = null;
  else
    delete from public.order_retention_queue
    where order_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_terminal_order_retention()
  from public, anon, authenticated;

drop trigger if exists orders_enqueue_terminal_retention on public.orders;
create trigger orders_enqueue_terminal_retention
after insert or update of status on public.orders
for each row
execute function public.enqueue_terminal_order_retention();

do $$
begin
  if exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'released_order_transactions'
  ) then
    alter publication supabase_realtime
      add table public.released_order_transactions;
  end if;
end;
$$;

-- Preserve each currently retained Released transaction before queuing its
-- detail rows and uploaded objects for immediate cleanup.
select public.capture_released_order_transaction(o.id)
from public.orders o
where o.status = 'Released';

insert into public.order_retention_queue (
  order_id,
  terminal_status,
  enqueued_at,
  attempts,
  locked_until,
  last_error
)
select o.id, o.status::text, pg_catalog.now(), 0, null, null
from public.orders o
where o.status in ('Released', 'Canceled')
on conflict (order_id) do update
  set terminal_status = excluded.terminal_status,
      enqueued_at = excluded.enqueued_at,
      attempts = 0,
      locked_until = null,
      last_error = null;
