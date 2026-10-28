import { supabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type {
  AttendanceRecordRow,
  AttendanceRecordInsert,
  AttendanceRecordUpdate,
  AttendanceAdjustmentInsert,
  AttendanceRecordDto,
  AttendanceSessionDto,
  AbsenceStatus,
  AppRole,
} from './types';

export type { AttendanceRecordDto, AttendanceSessionDto, AbsenceStatus } from './types';

// Attendance persistence for the staff clock-in/out system.
//
// Identity model in Supabase:
//   * `attendance_records.profile_id` — a REAL Supabase account (auth.uid ==
//     profiles.id), used for staff who can actually sign in (e.g. staff@test.com).
//   * `attendance_records.staff_id` — a `staff_records` directory row, used for
//     demo roaster members who have no auth account (Robert/Katie/Miguel/Ana).
// The app keys attendance by EMAIL; the repo resolves email → profile_id and/or
// staff_id before writing, and joins the person back on reads so the app can
// rebuild its email-keyed records after a hydrate.

// ── Identity resolution ──────────────────────────────────────────────────────

export interface AttendanceIdentity {
  profileId: string | null;
  staffId: string | null;
}

const identityCache = new Map<string, AttendanceIdentity>();

function cacheKey(email: string): string {
  return (email || '').trim().toLowerCase();
}

// Resolve an email to its Supabase identity (profile_id = real auth account,
// staff_id = staff_records directory row). Either can be null; a real auth
// account may ALSO have a staff_records row, in which case both are returned.
// Results are cached per email for the session.
export async function resolveAttendanceIdentity(email: string): Promise<AttendanceIdentity> {
  const key = cacheKey(email);
  if (!key) return { profileId: null, staffId: null };
  const cached = identityCache.get(key);
  if (cached) return cached;

  let profileId: string | null = null;
  let staffId: string | null = null;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', key)
      .maybeSingle();
    if (profile) profileId = profile.id;
  } catch {
    // keep null
  }

  try {
    const { data: staff } = await supabase
      .from('staff_records')
      .select('id')
      .eq('email', key)
      .maybeSingle();
    if (staff) staffId = staff.id;
  } catch {
    // keep null
  }

  const resolved = { profileId, staffId };
  identityCache.set(key, resolved);
  return resolved;
}

// ── DTO conversion ───────────────────────────────────────────────────────────

function toSessionDto(s?: { timeIn?: string; timeOut?: string }): AttendanceSessionDto | null {
  if (!s) return null;
  const timeIn = s.timeIn ? new Date(s.timeIn) : undefined;
  const timeOut = s.timeOut ? new Date(s.timeOut) : undefined;
  if (!timeIn && !timeOut) return null;
  return { timeIn, timeOut };
}

function parseSessions(json: unknown): AttendanceSessionDto[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((s) => toSessionDto(s as { timeIn?: string; timeOut?: string }))
    .filter((s): s is AttendanceSessionDto => !!s);
}

function toDto(
  row: AttendanceRecordRow,
  person: { email: string | null; name: string | null; role: AppRole | null } | undefined,
): AttendanceRecordDto {
  return {
    id: row.id,
    profileId: row.profile_id,
    staffId: row.staff_id,
    date: row.attendance_date,
    timeIn: row.time_in ? new Date(row.time_in) : null,
    timeOut: row.time_out ? new Date(row.time_out) : null,
    exceeded: row.exceeded === true,
    extraSessions: parseSessions(row.extra_sessions),
    absenceStatus: (row.absence_status === 'on-leave' || row.absence_status === 'absent'
      ? row.absence_status
      : null) as AbsenceStatus | null,
    notes: row.notes,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    email: person?.email ?? null,
    name: person?.name ?? null,
    role: person?.role === 'admin' || person?.role === 'staff' ? person.role : null,
  };
}

// ── Reads ────────────────────────────────────────────────────────────────────

// All attendance records the caller can see (RLS: own + staff/admin rows).
// Person info is joined back from `profiles` (by profile_id) and `staff_records`
// (by staff_id) so the caller can map rows to email-keyed app records.
export async function fetchAttendanceRecords(): Promise<AttendanceRecordDto[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .order('attendance_date', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as AttendanceRecordRow[];
  if (rows.length === 0) return [];

  const profileIds = Array.from(new Set(rows.map((r) => r.profile_id).filter((v): v is string => !!v)));
  const staffIds = Array.from(new Set(rows.map((r) => r.staff_id).filter((v): v is string => !!v)));

  const profileMap = new Map<string, { email: string | null; name: string | null; role: AppRole | null }>();
  const staffMap = new Map<string, { email: string | null; name: string | null; role: AppRole | null }>();

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('id', profileIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { email: p.email, name: p.full_name, role: p.role });
    }
  }
  if (staffIds.length > 0) {
    const { data: staff } = await supabase
      .from('staff_records')
      .select('id, email, full_name, role')
      .in('id', staffIds);
    for (const s of staff ?? []) {
      staffMap.set(s.id, { email: s.email, name: s.full_name, role: s.role });
    }
  }

  return rows.map((row) => {
    const person =
      (row.profile_id && profileMap.get(row.profile_id)) ||
      (row.staff_id && staffMap.get(row.staff_id)) ||
      undefined;
    return toDto(row, person);
  });
}

// ── Writes ───────────────────────────────────────────────────────────────────

// Resolve identity by email, then find-or-create the record for (identity, date).
// Returns the DB record id. Times are stored as ISO-8601 UTC strings. The input
// is keyed by email (the app's identity) — the repo resolves it per write, so
// the store never has to.
export interface UpsertAttendanceRecordInput {
  email: string;
  date: string; // YYYY-MM-DD (PHT day)
  timeIn?: Date | null;
  timeOut?: Date | null;
  exceeded?: boolean;
  extraSessions?: AttendanceSessionDto[];
  absenceStatus?: AbsenceStatus | null;
  notes?: string | null;
}

export async function upsertAttendanceRecord(
  input: UpsertAttendanceRecordInput,
): Promise<{ id: string; profileId: string | null; staffId: string | null }> {
  const identity = await resolveAttendanceIdentity(input.email);
  const timeInIso = input.timeIn ? input.timeIn.toISOString() : null;
  const timeOutIso = input.timeOut ? input.timeOut.toISOString() : null;
  const extraSessions = (input.extraSessions ?? [])
    .map((s) => ({
      ...(s.timeIn ? { timeIn: s.timeIn.toISOString() } : {}),
      ...(s.timeOut ? { timeOut: s.timeOut.toISOString() } : {}),
    }))
    .filter((s) => !!s.timeIn || !!s.timeOut);

  // Find the existing row for this identity/date (checking whichever id is set).
  const existing = await findRecordId(identity, input.date);

  if (existing) {
    const update: AttendanceRecordUpdate = { updated_at: new Date().toISOString() };
    // Each field is applied only when explicitly supplied, so a partial write
    // (e.g. syncing just an absence status) never clobbers the others.
    if (input.timeIn !== undefined) update.time_in = input.timeIn ? input.timeIn.toISOString() : null;
    if (input.timeOut !== undefined) update.time_out = input.timeOut ? input.timeOut.toISOString() : null;
    if (input.exceeded !== undefined) update.exceeded = input.exceeded === true;
    if (input.extraSessions !== undefined) {
      update.extra_sessions = extraSessions as unknown as AttendanceRecordRow['extra_sessions'];
    }
    if (input.absenceStatus !== undefined) {
      update.absence_status = input.absenceStatus ?? null;
    }
    if (input.notes !== undefined) update.notes = input.notes ?? null;
    const { error } = await supabase.from('attendance_records').update(update).eq('id', existing);
    if (error) throw error;
    return { id: existing, profileId: identity.profileId, staffId: identity.staffId };
  }

  const insert: AttendanceRecordInsert = {
    profile_id: identity.profileId,
    staff_id: identity.staffId,
    attendance_date: input.date,
    time_in: timeInIso,
    time_out: timeOutIso,
    exceeded: input.exceeded === true,
    extra_sessions: extraSessions as unknown as AttendanceRecordRow['extra_sessions'],
    absence_status: input.absenceStatus ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from('attendance_records')
    .insert(insert)
    .select('id, profile_id, staff_id')
    .single();
  if (error) throw error;
  return { id: data.id, profileId: data.profile_id, staffId: data.staff_id };
}

async function findRecordId(
  identity: AttendanceIdentity,
  date: string,
): Promise<string | null> {
  let query = supabase.from('attendance_records').select('id').eq('attendance_date', date);
  if (identity.profileId) query = query.eq('profile_id', identity.profileId);
  else if (identity.staffId) query = query.eq('staff_id', identity.staffId);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Remove a record entirely (used to wipe a day). Returns true when a row existed.
export async function deleteAttendanceRecord(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('attendance_records').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ── Adjustments audit ────────────────────────────────────────────────────────

// Record an admin-level correction to an attendance record. `adjustedBy` is the
// acting admin's profile id (auth.uid()) — resolves from the session when not
// supplied.
export interface LogAttendanceAdjustmentInput {
  attendanceId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason?: string | null;
  adjustedBy?: string | null;
}

export async function logAttendanceAdjustment(input: LogAttendanceAdjustmentInput): Promise<void> {
  let adjustedBy = input.adjustedBy ?? null;
  if (!adjustedBy) {
    const { data: sessionData } = await supabase.auth.getSession();
    adjustedBy = sessionData.session?.user.id ?? null;
  }
  const insert: AttendanceAdjustmentInsert = {
    attendance_id: input.attendanceId,
    field_name: input.fieldName,
    old_value: input.oldValue,
    new_value: input.newValue,
    reason: input.reason ?? null,
    adjusted_by: adjustedBy,
  };
  const { error } = await supabase.from('attendance_adjustments').insert(insert);
  if (error) throw error;
}

// ── Realtime ─────────────────────────────────────────────────────────────────

// Live refresh any time an attendance record changes (another tab / device / the
// staff's own clock-in while an admin monitors). Mirrors the order realtime hook.
export function subscribeAttendanceChanges(cb: () => void): () => void {
  return subscribeTableChanges('attendance_records', cb);
}

// ── Small helpers ────────────────────────────────────────────────────────────

// Philippines is UTC+8, no DST. The app computes "today" as the PHT calendar
// day, so date keys must shift UTC by this offset before formatting.
const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

// The PHT date key for a UTC instant (used to build `date` fields consistently).
export function toPHTDateKey(ms: number | Date): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  const pht = new Date(d.getTime() + PHT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pht.getUTCFullYear()}-${pad(pht.getUTCMonth() + 1)}-${pad(pht.getUTCDate())}`;
}
