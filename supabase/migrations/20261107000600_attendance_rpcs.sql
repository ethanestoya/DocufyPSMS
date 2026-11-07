-- Server-authoritative time clock.
--
-- `attendance_records` drives salary (hours × hourly rate), yet the browser
-- could write any column for any date directly, including back-dating a shift.
-- These RPCs now own the writes:
--
--   clock_in   / clock_out        self-service, always "today" in PHT, server time
--   admin_upsert_attendance      admin correction for a given date, with the
--                                matching attendance_adjustments audit row
--   admin_set_attendance_absence admin leave/absent marker for a given date
--
-- The app keeps its local mirror as the UI source of truth, but the server row
-- is what the salary figures ultimately read. Direct table grants are revoked
-- in the later revoke migration.

create or replace function public.attendance_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Asia/Manila')::date;
$$;

create or replace function public.clock_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := public.attendance_today();
  v_staff_id uuid;
  v_record public.attendance_records%rowtype;
  v_open_extra integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select id into v_staff_id
    from public.staff_records
   where lower(email) = lower((select email from public.profiles where id = v_uid))
   limit 1;

  select * into v_record
    from public.attendance_records
   where profile_id = v_uid and attendance_date = v_date
   for update;

  if not found then
    insert into public.attendance_records (
      profile_id, staff_id, attendance_date, time_in, time_out, exceeded, extra_sessions
    ) values (
      v_uid, v_staff_id, v_date, now(), null, false, '[]'::jsonb
    )
    returning * into v_record;
    return to_jsonb(v_record);
  end if;

  if v_record.time_in is null then
    update public.attendance_records
       set time_in = now(), updated_at = now()
     where id = v_record.id
     returning * into v_record;
    return to_jsonb(v_record);
  end if;

  if v_record.time_out is null then
    raise exception 'already_clocked_in' using errcode = 'P0001';
  end if;

  select min((s.ordinality - 1)::integer)
    into v_open_extra
    from jsonb_array_elements(coalesce(v_record.extra_sessions, '[]'::jsonb)) with ordinality as s(value, ordinality)
   where s.value->>'timeIn' is not null
     and s.value->>'timeOut' is null;

  if v_open_extra is not null then
    raise exception 'already_clocked_in' using errcode = 'P0001';
  end if;

  update public.attendance_records
     set exceeded = true,
         extra_sessions = coalesce(extra_sessions, '[]'::jsonb)
           || jsonb_build_array(jsonb_build_object('timeIn', now())),
         updated_at = now()
   where id = v_record.id
   returning * into v_record;

  return to_jsonb(v_record);
end;
$$;

create or replace function public.clock_out()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_date date := public.attendance_today();
  v_record public.attendance_records%rowtype;
  v_open_extra integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_record
    from public.attendance_records
   where profile_id = v_uid and attendance_date = v_date
   for update;

  if not found or v_record.time_in is null then
    raise exception 'no_attendance_record_for_today' using errcode = 'P0002';
  end if;

  if v_record.time_out is null then
    update public.attendance_records
       set time_out = now(), updated_at = now()
     where id = v_record.id
     returning * into v_record;
    return to_jsonb(v_record);
  end if;

  select max((s.ordinality - 1)::integer)
    into v_open_extra
    from jsonb_array_elements(coalesce(v_record.extra_sessions, '[]'::jsonb)) with ordinality as s(value, ordinality)
   where s.value->>'timeIn' is not null
     and s.value->>'timeOut' is null;

  if v_open_extra is null then
    raise exception 'no_active_attendance_session' using errcode = 'P0001';
  end if;

  update public.attendance_records
     set extra_sessions = jsonb_set(
           coalesce(extra_sessions, '[]'::jsonb),
           array[v_open_extra::text, 'timeOut'],
           to_jsonb(now()),
           true
         ),
         updated_at = now()
   where id = v_record.id
   returning * into v_record;

  return to_jsonb(v_record);
end;
$$;

create or replace function public.admin_upsert_attendance(
  p_email text,
  p_date date,
  p_field text,
  p_value timestamptz,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_staff_id uuid;
  v_record public.attendance_records%rowtype;
  v_before timestamptz;
  v_created boolean := false;
begin
  if not public.is_admin() then
    raise exception 'attendance_corrections_require_admin' using errcode = '42501';
  end if;
  if p_field not in ('timeIn', 'timeOut') then
    raise exception 'invalid_attendance_field' using errcode = '22023';
  end if;

  select id into v_profile_id from public.profiles where lower(email) = lower(p_email) limit 1;
  select id into v_staff_id from public.staff_records where lower(email) = lower(p_email) limit 1;

  if v_profile_id is null then
    raise exception 'attendance_identity_missing' using errcode = 'P0002';
  end if;

  select * into v_record
    from public.attendance_records
   where profile_id = v_profile_id and attendance_date = p_date
   for update;

  if not found then
    v_created := true;
    insert into public.attendance_records (
      profile_id, staff_id, attendance_date, time_in, time_out, exceeded, extra_sessions
    ) values (
      v_profile_id,
      v_staff_id,
      p_date,
      case when p_field = 'timeIn' then p_value else null end,
      case when p_field = 'timeOut' then p_value else null end,
      false,
      '[]'::jsonb
    )
    returning * into v_record;
  else
    if p_field = 'timeIn' then
      v_before := v_record.time_in;
      if p_value is null then
        update public.attendance_records
           set time_in = null,
               time_out = null,
               exceeded = false,
               extra_sessions = '[]'::jsonb,
               updated_at = now()
         where id = v_record.id
         returning * into v_record;
      else
        update public.attendance_records
           set time_in = p_value, updated_at = now()
         where id = v_record.id
         returning * into v_record;
      end if;
    else
      if v_record.time_in is null and p_value is not null then
        raise exception 'time_in_required_before_time_out' using errcode = 'P0001';
      end if;
      v_before := v_record.time_out;
      update public.attendance_records
         set time_out = p_value, updated_at = now()
       where id = v_record.id
       returning * into v_record;
    end if;

    if (v_before is distinct from p_value) then
      insert into public.attendance_adjustments (
        attendance_id, field_name, old_value, new_value, reason, adjusted_by
      ) values (
        v_record.id,
        case when p_field = 'timeIn' then 'time_in' else 'time_out' end,
        v_before,
        p_value,
        coalesce(nullif(trim(p_reason), ''), 'Admin manual adjustment'),
        auth.uid()
      );
    end if;
  end if;

  return to_jsonb(v_record) || jsonb_build_object('wasCreated', v_created);
end;
$$;

create or replace function public.admin_set_attendance_absence(
  p_email text,
  p_date date,
  p_absence text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_staff_id uuid;
  v_record public.attendance_records%rowtype;
  v_absence text := nullif(trim(coalesce(p_absence, '')), '');
begin
  if not public.is_admin() then
    raise exception 'attendance_corrections_require_admin' using errcode = '42501';
  end if;
  if v_absence is not null and v_absence not in ('on-leave', 'absent') then
    raise exception 'invalid_absence_status' using errcode = '22023';
  end if;

  select id into v_profile_id from public.profiles where lower(email) = lower(p_email) limit 1;
  select id into v_staff_id from public.staff_records where lower(email) = lower(p_email) limit 1;

  if v_profile_id is null then
    raise exception 'attendance_identity_missing' using errcode = 'P0002';
  end if;

  select * into v_record
    from public.attendance_records
   where profile_id = v_profile_id and attendance_date = p_date
   for update;

  if not found then
    insert into public.attendance_records (
      profile_id, staff_id, attendance_date, absence_status, extra_sessions
    ) values (
      v_profile_id, v_staff_id, p_date, v_absence, '[]'::jsonb
    )
    returning * into v_record;
  else
    update public.attendance_records
       set absence_status = v_absence, updated_at = now()
     where id = v_record.id
     returning * into v_record;
  end if;

  return to_jsonb(v_record);
end;
$$;

revoke all on function public.clock_in() from public;
revoke all on function public.clock_out() from public;
revoke all on function public.admin_upsert_attendance(text, date, text, timestamptz, text) from public;
revoke all on function public.admin_set_attendance_absence(text, date, text) from public;

grant execute on function public.clock_in() to authenticated;
grant execute on function public.clock_out() to authenticated;
grant execute on function public.admin_upsert_attendance(text, date, text, timestamptz, text) to authenticated;
grant execute on function public.admin_set_attendance_absence(text, date, text) to authenticated;
