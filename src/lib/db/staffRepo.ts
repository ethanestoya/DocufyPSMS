// Staff + salary repository: the roster (`staff_records`), its hydrate-only
// nested demo data (performance notes / allowances / tasks), and the salary
// tracking tables (`salary_settings` single row + `salary_releases` history).
//
// RLS: SELECT/INSERT/UPDATE/DELETE on all of these are staff/admin only (the
// customer never reads staff or salary data). The demo `ensureStaffRecords`
// seed already writes the roster; `ensureSalarySettings` seeds the rate.

import { supabase } from '../supabaseClient';
import type {
  SalaryReleaseDto,
  SalaryReleaseInsert,
  SalaryReleaseRow,
  SalarySettingsInsert,
  SalarySettingsRow,
  StaffAllowanceRow,
  StaffPerformanceNoteRow,
  StaffRecordInsert,
  StaffRecordRow,
  StaffTaskRow,
} from './types';

// ── Roster ───────────────────────────────────────────────────────────────────

export async function fetchStaffRecords(): Promise<StaffRecordRow[]> {
  const { data, error } = await supabase.from('staff_records').select('*');
  if (error) throw error;
  return (data ?? []) as StaffRecordRow[];
}

// Map a staff email → its `staff_records.id` (used to attach salary releases to
// the right roster row). Returns null when the email has no directory row.
export async function resolveStaffRecordIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('staff_records')
    .select('id')
    .eq('email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function sessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// Upsert a roster row: update by id when the caller knows the hydrate snapshot's
// row id (mirrors `saveInventoryItem`), else insert and adopt the server uuid.
// Falls back to update-by-email when an insert hits an existing account.
export async function saveStaffMember(input: {
  id?: string;
  row: StaffRecordInsert;
}): Promise<string> {
  if (input.id) {
    const { error } = await supabase
      .from('staff_records')
      .update(input.row)
      .eq('id', input.id);
    if (error) throw error;
    return input.id;
  }

  const { data, error } = await supabase
    .from('staff_records')
    .insert(input.row)
    .select('id')
    .maybeSingle();
  if (error) {
    // Already exists under a different row id (e.g. seeded by another device):
    // update by email instead of failing the save.
    if (input.row.email && error.code === '23505') {
      const { data: updateData, error: updateError } = await supabase
        .from('staff_records')
        .update(input.row)
        .eq('email', input.row.email)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      return updateData?.id ?? '';
    }
    throw error;
  }
  return data?.id ?? '';
}

// ── Nested demo data (hydrate-only — displayed, never edited) ────────────────

export async function fetchStaffPerformanceNotes(): Promise<StaffPerformanceNoteRow[]> {
  const { data, error } = await supabase
    .from('staff_performance_notes')
    .select('*')
    .order('note_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StaffPerformanceNoteRow[];
}

export async function fetchStaffAllowances(): Promise<StaffAllowanceRow[]> {
  const { data, error } = await supabase.from('staff_allowances').select('*');
  if (error) throw error;
  return (data ?? []) as StaffAllowanceRow[];
}

export async function fetchStaffTasks(): Promise<StaffTaskRow[]> {
  const { data, error } = await supabase.from('staff_tasks').select('*');
  if (error) throw error;
  return (data ?? []) as StaffTaskRow[];
}

// ── Salary settings (single row, hourly rate) ────────────────────────────────

export async function fetchSalarySettings(): Promise<SalarySettingsRow | null> {
  const { data, error } = await supabase
    .from('salary_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle();
  if (error) throw error;
  return (data as SalarySettingsRow | null) ?? null;
}

export async function upsertSalarySettings(
  patch: Partial<Omit<SalarySettingsRow, 'id'>>,
): Promise<void> {
  const row: SalarySettingsInsert = { id: true, ...patch };
  const { error } = await supabase
    .from('salary_settings')
    .upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

// ── Salary releases history ──────────────────────────────────────────────────

// The DB rows only carry ids, so resolution joins back email/full_name from
// `staff_records` and the actor's name from `profiles` (by released_by id).
export async function fetchSalaryReleases(): Promise<SalaryReleaseDto[]> {
  const { data, error } = await supabase
    .from('salary_releases')
    .select('*')
    .order('released_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as SalaryReleaseRow[];
  if (rows.length === 0) return [];

  const staffIds = Array.from(new Set(rows.map((r) => r.staff_id).filter(Boolean)));

  const identities = new Map<string, { email: string; name: string }>();
  if (staffIds.length > 0) {
    const { data: staffRows, error: staffError } = await supabase
      .from('staff_records')
      .select('id, email, full_name')
      .in('id', staffIds);
    if (staffError) throw staffError;
    for (const s of staffRows ?? []) {
      identities.set(s.id, { email: s.email ?? '', name: s.full_name ?? '' });
    }
  }

  const actorIds = Array.from(
    new Set(rows.map((r) => r.released_by).filter((x): x is string => Boolean(x))),
  );
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: actorRows, error: actorError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', actorIds);
    if (actorError) throw actorError;
    for (const a of actorRows ?? []) actorNames.set(a.id, a.full_name ?? '');
  }

  return rows.map((r) => {
    const who = identities.get(r.staff_id);
    const actor = r.released_by ? actorNames.get(r.released_by) : null;
    const dto: SalaryReleaseDto = {
      id: r.id,
      staffEmail: who?.email ?? '',
      staffName: who?.name ?? '',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      totalHours: r.total_hours,
      hourlyRate: r.hourly_rate,
      releasedAmount: r.released_amount,
      releasedAt: r.released_at,
      releasedByName: actor ?? (r.released_by ? '—' : 'Admin'),
    };
    return dto;
  });
}

export async function insertSalaryRelease(row: SalaryReleaseInsert): Promise<string> {
  const { data, error } = await supabase
    .from('salary_releases')
    .insert(row)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? '';
}
