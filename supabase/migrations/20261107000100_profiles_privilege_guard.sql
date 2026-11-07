-- Server-authoritative profile privileges.
--
-- Before this migration a customer could PATCH their own `profiles` row and set
-- `role = 'admin'` (or `active`, or `employee_id`) because the table policy is
-- owner-scoped and only column-level UI hid those fields. The guard below runs
-- BEFORE INSERT/UPDATE and:
--   * refuses anonymous writes entirely;
--   * lets staff/admin (and definer functions such as `handle_new_user`) write
--     every column;
--   * forces a self-service INSERT to `role = customer`, `active = true`,
--     `suspended = false`, `employee_id = null`;
--   * refuses a self-service UPDATE that changes a privilege column.
--
-- SECURITY INVOKER on purpose: `current_user` is the role that issued the
-- statement, so a SECURITY DEFINER RPC (owned by postgres) is recognised as
-- trusted without a forgeable session GUC.

create or replace function public.guard_profiles_privilege()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user = 'anon' then
    raise exception 'profile_write_requires_authentication'
      using errcode = '42501';
  end if;

  if current_user <> 'authenticated' then
    return new;
  end if;

  if public.is_staff_or_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'customer';
    new.active := true;
    new.suspended := false;
    new.employee_id := null;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'profile_id_is_immutable'
      using errcode = '42501';
  end if;

  if new.role is distinct from old.role
     or new.active is distinct from old.active
     or new.suspended is distinct from old.suspended
     or new.employee_id is distinct from old.employee_id
     or new.email is distinct from old.email then
    raise exception 'profile_privilege_columns_are_admin_only'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profiles_privilege on public.profiles;
create trigger guard_profiles_privilege
  before insert or update on public.profiles
  for each row
  execute function public.guard_profiles_privilege();
