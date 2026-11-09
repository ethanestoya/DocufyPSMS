import { supabase } from '../supabaseClient';
import { subscribeTableChanges } from './hooks';
import type {
  AttendanceRecordRow,
  AttendanceRecordDto,
  AttendanceSessionDto,
  AbsenceStatus,
  AppRole,
} from './types';

export type { AttendanceRecordDto, AttendanceSessionDto, AbsenceStatus } from './types';

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: any; error: any }>;
// Keep the call bound to the client: supabase-js reads `this.rest` inside rpc(),
// so a detached reference throws "Cannot read properties of undefined (reading 'rest')".
const rpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc;

// Attendance persistence for the staff clock-in/out system.
//
// Identity model in Supabase:
//   * `attendance_records.profile_id` — a REAL Supabase account (auth.uid ==
//     profiles.id), used for staff who can actually sign in (e.g. staff@test.com).
//   * `attendance_records.staff_id` — a `staff_records` directory row, used for
//     demo roster members who have no auth account (Robert/Katie/Miguel/Ana).
// The app keys attendance by EMAIL; reads join the person back so the app can
// rebuild its email-keyed records after a hydrate. Writes go through
// server-authoritative RPCs (`clock_in`/`clock_out` for self, `admin_*` for
// corrections) so the salary-driving times are never client-authored.

// ── Identity resolution ──────────────────────────────────────────────────────

export interface AttendanceIdentity {
  profileId: string | null;
  staffId: string | null;
}

const identityCache = new Map<string, AttendanceIdentity>();

function cacheKey(email: string): string {
  return (email || '').trim().toLowerCase();
}

// Raised when an email matches neither a `profiles` row nor a `staff_records`
// row. Kept for compatibility with store messaging.
export class AttendanceIdentityMissingError extends Error {
  readonly email: string;
  constructor(email: string) {
    super(`No staff record is linked to ${email} yet, so attendance can only be saved on this device.`);
    this.name = 'AttendanceIdentityMissingError';
    this.email = email;
  }
}

// Resolve an email to its Supabase identity. Still used for read-side joins and
// as a best-effort preflight for UI messaging.
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
  if (profileId || staffId) identityCache.set(key, resolved);
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

export function attendanceRowToDto(
  row: AttendanceRecordRow,
  person?: { email: string | null; name: string | null; role: AppRole | null },
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
    return attendanceRowToDto(row, person);
  });
}

// ── Server-authoritative writes (RPCs) ───────────────────────────────────────

export async function clockInRpc(): Promise<AttendanceRecordRow> {
  const { data, error } = await rpc('clock_in');
  if (error) throw error;
  return data as AttendanceRecordRow;
}

export async function clockOutRpc(): Promise<AttendanceRecordRow> {
  const { data, error } = await rpc('clock_out');
  if (error) throw error;
  return data as AttendanceRecordRow;
}

export async function adminUpsertAttendanceRpc(
  email: string,
  date: string,
  field: 'timeIn' | 'timeOut',
  value: Date | null,
  reason?: string | null,
): Promise<AttendanceRecordRow> {
  const { data, error } = await rpc('admin_upsert_attendance', {
    p_email: email,
    p_date: date,
    p_field: field,
    p_value: value ? value.toISOString() : null,
    p_reason: reason ?? null,
  });
  if (error) throw error;
  return data as AttendanceRecordRow;
}

export async function adminSetAttendanceAbsenceRpc(
  email: string,
  date: string,
  absence: AbsenceStatus | null,
): Promise<AttendanceRecordRow> {
  const { data, error } = await rpc('admin_set_attendance_absence', {
    p_email: email,
    p_date: date,
    p_absence: absence ?? null,
  });
  if (error) throw error;
  return data as AttendanceRecordRow;
}

// ── Realtime ─────────────────────────────────────────────────────────────────

export function subscribeAttendanceChanges(cb: () => void): () => void {
  return subscribeTableChanges('attendance_records', cb);
}

// ── Small helpers ────────────────────────────────────────────────────────────

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

export function toPHTDateKey(ms: number | Date): string {
  const d = ms instanceof Date ? ms : new Date(ms);
  const pht = new Date(d.getTime() + PHT_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pht.getUTCFullYear()}-${pad(pht.getUTCMonth() + 1)}-${pad(pht.getUTCDate())}`;
}

// Kept for any lingering imports; adjustments are now written inside the
// admin_upsert_attendance RPC.
export async function logAttendanceAdjustment(_input: {
  attendanceId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason?: string | null;
  adjustedBy?: string | null;
}): Promise<void> {
  return;
}
