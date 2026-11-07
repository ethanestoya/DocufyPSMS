-- Attendance writes become RPC-only for authenticated users.
--
-- The self clock-in/out and admin correction RPCs run as security definer and
-- bypass this guard (current_user <> 'authenticated'), so they keep working
-- after direct grants are revoked. A direct INSERT/UPDATE/DELETE by an
-- authenticated client is blocked, which closes the salary-driving self-edit
-- gap and the admin adjustment-audit bypass.

create or replace function public.guard_attendance_rpc_only()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user is distinct from 'authenticated' then
    return coalesce(new, old);
  end if;

  raise exception 'attendance_must_be_written_through_rpc' using errcode = '42501';
end;
$$;

drop trigger if exists trg_guard_attendance_records_rpc_only on public.attendance_records;
create trigger trg_guard_attendance_records_rpc_only
before insert or update or delete on public.attendance_records
for each row
execute function public.guard_attendance_rpc_only();

drop trigger if exists trg_guard_attendance_adjustments_rpc_only on public.attendance_adjustments;
create trigger trg_guard_attendance_adjustments_rpc_only
before insert or update or delete on public.attendance_adjustments
for each row
execute function public.guard_attendance_rpc_only();
