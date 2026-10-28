// ── Attendance management system — single daily session model ──────────────
// One Time In and one Time Out per day (covers the whole shift — there is no
// separate Morning/Afternoon split anymore). Staff can still clock back in
// AFTER the day is complete; that extra clock-in is flagged `exceeded` and is
// surfaced as "Exceeded" in the staff timesheet and admin monitoring logs.
//
// Backend integration: this is now a Supabase-backed facade. The sync read API
// (getRecord/getUserLogs/getAllLogs/getNextAction/subscribe …) and the
// localStorage mirror stay untouched so every existing consumer just works, but
// every mutation ALSO writes through to the `attendance_records` table
// (fire-and-forget, with a toast + keep-local on failure) and admin time
// corrections are audited in `attendance_adjustments`. The in-memory cache
// hydrates from the DB on load and follows realtime changes, so another tab or
// device (e.g. staff clocking in while an admin monitors) shows up live.
import { internetUtcMs, toPHT, formatPHTime } from "./pht";
import { auditLogStore } from "./auditLogStore";
import {
  fetchAttendanceRecords,
  upsertAttendanceRecord,
  logAttendanceAdjustment,
  subscribeAttendanceChanges,
  type AttendanceRecordDto,
} from "../../lib/db/attendanceRepo";
import { toast } from "sonner";
import { authReady } from "../../lib/supabaseClient";

export type SessionRecord = {
  timeIn?: Date;
  timeOut?: Date;
};

export type DailyAttendanceRecord = {
  id: string;
  userId: string;
  userName: string;
  role: 'admin' | 'staff';
  date: string; // YYYY-MM-DD
  timeIn?: Date;                      // the day's single primary clock-in
  timeOut?: Date;                     // the day's single primary clock-out
  exceeded?: boolean;                 // staff clocked back in after the day was complete
  extraSessions: SessionRecord[];     // post-complete extra clock-ins (the "exceeded" ones)
  // Legacy v1 shape (Morning/Afternoon split) — migrated to the single fields
  // on restore, then cleared. Never written for new records.
  morning?: SessionRecord;
  afternoon?: SessionRecord;
};

// Determines which action the user should perform next.
export type NextAction =
  | 'time-in'    // No active session today
  | 'time-out'   // A session is currently open (running timer)
  | 'complete';  // Day fully recorded (time-in + time-out, nothing active)

// Backward-compat shapes kept for any legacy consumers.
export type AttendanceLog = {
  id: string;
  userId: string;
  userName: string;
  role: 'admin' | 'staff';
  timeIn: Date;
  timeOut?: Date;
  status: 'active' | 'inactive';
};

export type UserAvailability = {
  isTimedIn: boolean;
  currentLog?: AttendanceLog;
};

type Subscriber = () => void;

// ── Helpers ────────────────────────────────────────────────────────────────
const pad2 = (n: number): string => String(n).padStart(2, '0');

const toDateKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // local YYYY-MM-DD

const calcDurationMs = (start: Date, end: Date = new Date()): number =>
  Math.max(0, end.getTime() - start.getTime());

const formatDuration = (ms: number): string => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
};

export { formatDuration, calcDurationMs };

// ── Philippines time (UTC+8) helpers ───────────────────────────────────────
// All product-facing time is pinned to the Philippines timezone regardless of
// the viewer's device clock, so a Philippine printing-shop system reads
// correctly everywhere.
export const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

// Current instant shifted to the PHT wall-clock (a local-view Date carrying the
// Philippines calendar time/date). Use .getHours()/.getDay()/.getDate() on this
// to derive PHT-based periods/days. Uses internet-corrected GMT+8 so the clock
// reads true Philippines time even if the device clock is off.
export const nowPHT = (): Date => toPHT(new Date(internetUtcMs()));

// Philippines date key (YYYY-MM-DD) for the current moment.
export const todayPHTKey = (): string => toDateKey(nowPHT());

// Format a UTC instant as a PHT HH:MM (or HH:MM:SS with includeSeconds).
// Timezone-independent: resolved via Intl Asia/Manila.
export const formatPHT = (d: Date | undefined | null, includeSeconds = false): string => {
  if (!d || Number.isNaN(d.getTime())) return '—';
  return formatPHTime(d, { hour12: false, includeSeconds });
};

// True while a session (the main one or an extra) is currently open.
export const hasActiveSession = (record?: DailyAttendanceRecord): boolean => {
  if (!record) return false;
  if (record.timeIn && !record.timeOut) return true;
  return !!record.extraSessions?.some(s => s.timeIn && !s.timeOut);
};

// True when a day was marked as exceeded (staff clocked back in after it was complete).
export const isExceeded = (record?: DailyAttendanceRecord): boolean => !!record?.exceeded;

// ── Timesheet analytics — constants & pure helpers ─────────────────────────
export const STANDARD_DAILY_HOURS = 8;
export const STANDARD_WEEKLY_HOURS = 40;

const MS_PER_HOUR = 3_600_000;

// Monday-based week-start date key (PHT date, YYYY-MM-DD)
export const getWeekStartKey = (d: Date = nowPHT()): string => {
  const daysSinceMonday = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysSinceMonday);
  return toDateKey(monday);
};

// Elapsed ms across a record's sessions (main + any extra); an active (not yet
// clocked-out) session counts up to `until` so live totals keep ticking — but
// never past the end of that record's PHT day, so a session that was never
// clocked out cannot grow across days (e.g. days-old demo seeds inflating to
// 70+ hours).

// Real UTC instant of the instant the record's PHT day ends (00:00 Manila of
// the following day = 16:00 UTC of the record date, since Manila is UTC+8).
const endOfPHTDayMs = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return Number.POSITIVE_INFINITY;
  return Date.UTC(y, m - 1, d, 16, 0, 0);
};

export const sessionTotalMs = (record: DailyAttendanceRecord, until: Date = new Date()): number => {
  const cap = endOfPHTDayMs(record.date);
  const endMs = (clockedOut?: Date): number =>
    clockedOut ? clockedOut.getTime() : Math.min(until.getTime(), cap);
  let total = 0;
  if (record.timeIn) {
    total += Math.max(0, endMs(record.timeOut) - record.timeIn.getTime());
  }
  for (const s of record.extraSessions ?? []) {
    if (s.timeIn) total += Math.max(0, endMs(s.timeOut) - s.timeIn.getTime());
  }
  return total;
};

// The single-session model has no Morning/Afternoon gap, so breaks aren't
// derived from the sessions anymore. Kept as a 0 stub for any legacy consumers.
export const sessionBreakMs = (record: DailyAttendanceRecord): number => 0;

// Overtime ms beyond a standard window (defaults: 8h/day, 40h/week).
export const overtimeMs = (totalMs: number, standardHours: number = STANDARD_DAILY_HOURS): number =>
  Math.max(0, totalMs - standardHours * MS_PER_HOUR);

// ── Store ──────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'docufy_attendance_records_v1';
const ABSENCE_KEY = 'docufy_attendance_absences_v1';

export type AbsenceType = 'on-leave' | 'absent';

type AbsenceEntry = {
  userId: string;
  date: string; // YYYY-MM-DD
  type: AbsenceType;
};

type StoredSession = { timeIn?: string; timeOut?: string };
type StoredRecord = Omit<
  DailyAttendanceRecord,
  'timeIn' | 'timeOut' | 'extraSessions' | 'morning' | 'afternoon'
> & {
  timeIn?: string;
  timeOut?: string;
  extraSessions?: StoredSession[];
  morning?: StoredSession;
  afternoon?: StoredSession;
};

class AttendanceStore {
  private records: DailyAttendanceRecord[] = [];
  private absences: Map<string, AbsenceType> = new Map(); // `${userId}|${date}` -> type
  private subscribers: Set<Subscriber> = new Set();
  private hydrating: Promise<void> | null = null;
  private dbSyncing = new Set<string>(); // record id currently being pushed

  constructor() {
    this.restore();
    this.restoreAbsences();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", this.onStorage);
    }
    // Hydrate from Supabase + follow realtime so the cache reflects the
    // backend (other tabs/devices). Any failure is silent — the localStorage
    // mirror keeps serving data offline.
    void this.hydrate();
    subscribeAttendanceChanges(() => void this.hydrate());
  }

  // ── Backend hydration ──────────────────────────────────────────────────
  // Reload records/absences from `attendance_records`. Concurrent calls share
  // one in-flight request. DB rows whose person maps back to an email become
  // app records (keyed by email); the local mirror remains the fallback.
  private hydrate(): Promise<void> {
    if (this.hydrating) return this.hydrating;
    this.hydrating = (async () => {
      await authReady;
      try {
        const dtos = await fetchAttendanceRecords();
        this.applyDtos(dtos);
        this.notify();
      } catch (err) {
        console.warn("[attendanceStore] hydrate failed (local mirror kept):", err);
      } finally {
        this.hydrating = null;
      }
    })();
    return this.hydrating;
  }

  // Public force-refetch entry (used by storeSync when auth settles).
  refresh(): Promise<void> {
    return this.hydrate();
  }

  private applyDtos(dtos: AttendanceRecordDto[]): void {
    const byKey = new Map<string, DailyAttendanceRecord>();
    for (const r of this.records) {
      byKey.set(`${r.userId.toLowerCase()}|${r.date}`, r);
    }

    for (const dto of dtos) {
      if (!dto.email) continue; // row resolves to no known person — skip
      const key = `${dto.email.toLowerCase()}|${dto.date}`;
      const record: DailyAttendanceRecord = {
        id: dto.id,
        userId: dto.email,
        userName: dto.name ?? dto.email,
        role: dto.role === "admin" ? "admin" : "staff",
        date: dto.date,
        timeIn: dto.timeIn ?? undefined,
        timeOut: dto.timeOut ?? undefined,
        exceeded: dto.exceeded === true,
        extraSessions: dto.extraSessions ?? [],
      };
      byKey.set(key, record);
      // Absence/leave marks live on the record itself in the DB.
      if (dto.absenceStatus) {
        this.absences.set(`${dto.email.toLowerCase()}|${dto.date}`, dto.absenceStatus);
      }
    }

    this.records = [...byKey.values()];
  }

  // ── Backend write-through (fire-and-forget) ────────────────────────────
  // Pushes a single record to `attendance_records`. Local state is ALWAYS
  // authoritative for the current session — the DB push is best-effort; on
  // failure the change is kept locally (offline mode) and a toast surfaces it.
  private pushRecord(record: DailyAttendanceRecord): void {
    if (this.dbSyncing.has(record.id)) return;
    this.dbSyncing.add(record.id);

    void (async () => {
      try {
        await upsertAttendanceRecord({
          email: record.userId,
          date: record.date,
          timeIn: record.timeIn ?? null,
          timeOut: record.timeOut ?? null,
          exceeded: record.exceeded === true,
          extraSessions: record.extraSessions ?? [],
        });
      } catch (err) {
        console.warn("[attendanceStore] DB push failed (kept locally):", err);
        toast.error("Attendance time clock couldn't sync to the server — kept locally.");
      } finally {
        this.dbSyncing.delete(record.id);
      }
    })();
  }

  // Persist an absence/leave mark to the DB (as `absence_status` on the day's
  // record; creates the record when the person has none that day).
  private pushAbsence(userId: string, date: string, type: AbsenceType | null): void {
    void (async () => {
      try {
        await upsertAttendanceRecord({
          email: userId,
          date,
          absenceStatus: type ?? null,
        });
      } catch (err) {
        console.warn("[attendanceStore] absence sync failed (kept locally):", err);
        toast.error("Attendance status couldn't sync to the server — kept locally.");
      }
    })();
  }

  // Cross-tab live sync: when another tab writes attendance/absences, reload
  // from localStorage and notify subscribers (staff detail, monitoring, timesheet).
  private onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      this.restore();
      this.notify();
    } else if (e.key === ABSENCE_KEY) {
      this.restoreAbsences();
      this.notify();
    }
  };

  // ── Persistence (demo: per-browser localStorage) ──────────────────────
  private serialize(): StoredRecord[] {
    const toStored = (s?: SessionRecord): StoredSession | undefined =>
      s?.timeIn || s?.timeOut
        ? {
            timeIn: s.timeIn?.toISOString(),
            timeOut: s.timeOut?.toISOString(),
          }
        : undefined;
    return this.records.map((r) => {
      const { morning, afternoon, ...rest } = r;
      void morning;
      void afternoon;
      return {
        ...rest,
        timeIn: r.timeIn?.toISOString(),
        timeOut: r.timeOut?.toISOString(),
        extraSessions: (r.extraSessions ?? [])
          .map(toStored)
          .filter((s): s is StoredSession => !!s),
      };
    });
  }

  private parseStored(iso?: string): Date | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }

  private parseSession(s?: StoredSession): SessionRecord {
    return {
      timeIn: this.parseStored(s?.timeIn),
      timeOut: this.parseStored(s?.timeOut),
    };
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize()));
    } catch {
      // storage unavailable — records stay in-memory for the session
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as StoredRecord[];
      this.records = parsed.map((r): DailyAttendanceRecord => {
        const timeIn = this.parseStored(r.timeIn) ?? this.parseStored(r.morning?.timeIn) ?? this.parseStored(r.afternoon?.timeIn);
        const timeOut = this.parseStored(r.timeOut) ?? this.parseStored(r.afternoon?.timeOut) ?? this.parseStored(r.morning?.timeOut);
        const { morning, afternoon, ...rest } = r;
        void morning;
        void afternoon;
        return {
          ...rest,
          timeIn,
          timeOut,
          exceeded: r.exceeded === true,
          extraSessions: (r.extraSessions ?? []).map(s => this.parseSession(s)),
        };
      });
    } catch {
      this.records = [];
    }
  }

  // ── Absence/leave persistence (admin monitoring — separate key) ────────
  private persistAbsences(): void {
    try {
      const entries: AbsenceEntry[] = [...this.absences.entries()].map(([key, type]) => {
        const [date, userId] = key.split('|');
        return { userId, date, type };
      });
      localStorage.setItem(ABSENCE_KEY, JSON.stringify(entries));
    } catch {
      // storage unavailable
    }
  }

  private restoreAbsences(): void {
    try {
      const raw = localStorage.getItem(ABSENCE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AbsenceEntry[];
      this.absences.clear();
      parsed.forEach(e => this.absences.set(`${e.userId}|${e.date}`, e.type));
    } catch {
      this.absences.clear();
    }
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  private notify(): void {
    this.persist();
    this.subscribers.forEach(cb => cb());
  }

  // ── Get or create today's record ──────────────────────────────────────
  private getOrCreateTodayRecord(
    userId: string,
    userName: string,
    role: 'admin' | 'staff',
  ): DailyAttendanceRecord {
    const today = toDateKey(nowPHT());
    const key = (userId || '').toLowerCase();
    let record = this.records.find(r => r.userId.toLowerCase() === key && r.date === today);
    if (!record) {
      record = {
        id: `ATT-${Date.now()}`,
        userId,
        userName,
        role,
        date: today,
        extraSessions: [],
      };
      this.records.push(record);
    }
    return record;
  }

  // ── Determine next action for user ────────────────────────────────────
  getNextAction(userId: string): NextAction {
    const today = toDateKey(nowPHT());
    const key = (userId || '').toLowerCase();
    const record = this.records.find(r => r.userId.toLowerCase() === key && r.date === today);
    if (!record || !record.timeIn) return 'time-in';
    if (hasActiveSession(record)) return 'time-out';
    return 'complete';
  }

  // ── Time In ───────────────────────────────────────────────────────────
  // First call records the day's primary clock-in. If the day is already
  // complete (time-in + time-out), a further clock-in is still allowed — it
  // opens an extra session, sets the `exceeded` flag, and is surfaced as
  // "Exceeded" in the staff/admin logs.
  timeIn(userId: string, userName: string, role: 'admin' | 'staff'): DailyAttendanceRecord {
    const record = this.getOrCreateTodayRecord(userId, userName, role);
    const now = new Date();

    if (!record.timeIn) {
      record.timeIn = now;
      this.notify();
      this.pushRecord(record);
      return record;
    }
    if (hasActiveSession(record)) {
      throw new Error('You are already clocked in. Please Time Out first.');
    }
    // Day's record is complete — allow the extra clock-in, flagged as exceeded.
    record.exceeded = true;
    record.extraSessions.push({ timeIn: now });
    this.notify();
    this.pushRecord(record);
    return record;
  }

  // ── Time Out ──────────────────────────────────────────────────────────
  // Closes whichever session is currently open (primary or an extra one).
  timeOut(userId: string): DailyAttendanceRecord {
    const today = toDateKey(nowPHT());
    const key = (userId || '').toLowerCase();
    const record = this.records.find(r => r.userId.toLowerCase() === key && r.date === today);

    if (!record || !record.timeIn) {
      throw new Error('No attendance record found for today. Please Time In first.');
    }
    if (hasActiveSession(record)) {
      if (record.timeIn && !record.timeOut) {
        record.timeOut = new Date();
      } else {
        const extra = record.extraSessions.find(s => s.timeIn && !s.timeOut);
        if (extra) extra.timeOut = new Date();
      }
    } else {
      throw new Error('No active session to Time Out from.');
    }

    this.notify();
    this.pushRecord(record);
    return record;
  }

  // ── Today's record for a user ─────────────────────────────────────────
  getTodayRecord(userId: string): DailyAttendanceRecord | null {
    const today = toDateKey(nowPHT());
    const key = (userId || '').toLowerCase();
    return this.records.find(r => r.userId.toLowerCase() === key && r.date === today) ?? null;
  }

  // ── All records for a user (newest date first) ───────────────────────
  getUserLogs(userId: string): DailyAttendanceRecord[] {
    const key = (userId || '').toLowerCase();
    return this.records
      .filter(r => r.userId.toLowerCase() === key)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // ── This week's records for a user (oldest date first) ───────────────
  getWeekRecords(userId: string): DailyAttendanceRecord[] {
    const start = getWeekStartKey();
    const key = (userId || '').toLowerCase();
    return this.records
      .filter(r => r.userId.toLowerCase() === key && r.date >= start)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── All records ───────────────────────────────────────────────────────
  getAllLogs(): DailyAttendanceRecord[] {
    return [...this.records].sort((a, b) => b.date.localeCompare(a.date));
  }

  // ── Get a record for a specific user + date ───────────────────────────
  getRecord(userId: string, date: string): DailyAttendanceRecord | null {
    const key = (userId || '').toLowerCase();
    return this.records.find(r => r.userId.toLowerCase() === key && r.date === date) ?? null;
  }

  // ── Manual adjustment (admin monitoring) ──────────────────────────────
  // Sets (or clears, value = null) the primary time-in/time-out. Creates the
  // record on first use so an admin can back-fill a day from the monitoring
  // table. Clearing the time-in wipes the day's session (incl. extras/signals).
  upsertTime(
    userId: string,
    userName: string,
    role: 'admin' | 'staff',
    date: string,
    field: 'timeIn' | 'timeOut',
    value: Date | null,
    push = true,
  ): DailyAttendanceRecord {
    let record = this.records.find(r => r.userId === userId && r.date === date);
    const created = !record;
    if (!record) {
      record = {
        id: `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        userId,
        userName,
        role,
        date,
        extraSessions: [],
      };
      this.records.push(record);
    }

    const before = field === 'timeIn' ? record.timeIn : record.timeOut;

    if (field === 'timeIn') {
      record.timeIn = value ?? undefined;
      if (!value) {
        record.timeOut = undefined;
        record.exceeded = false;
        record.extraSessions = [];
      }
    } else {
      if (!record.timeIn && value) {
        throw new Error('Set the Time In before adjusting Time Out.');
      }
      record.timeOut = value ?? undefined;
    }

    this.notify();

    // Sync to DB and, when this was a real change to an EXISTING row, audit it
    // in `attendance_adjustments` (admin corrections only — brand-new records
    // from the seed logic are plain inserts, not adjustments).
    const after = field === 'timeIn' ? record.timeIn : record.timeOut;
    const changed = (before?.getTime() ?? null) !== (after?.getTime() ?? null);
    if (!created && changed) {
      if (push) {
        auditLogStore.record({
          module: 'Attendance',
          action: 'Updated',
          reference: `${userName} — ${date}`,
          entityType: 'Attendance',
          entityId: record.id,
          title: 'Attendance Time Adjusted',
          description: `${userName}'s ${field === 'timeIn' ? 'time in' : 'time out'} on ${date} was corrected by an admin from ${before ? formatPHTime(before) : '—'} to ${after ? formatPHTime(after) : '—'}.`,
          changes: [{
            field: field === 'timeIn' ? 'Time In' : 'Time Out',
            previous: before ? formatPHTime(before) : '—',
            next: after ? formatPHTime(after) : '—',
          }],
        });
      }
      this.pushRecordAndAudit(record.id, field, before, after);
    } else if (push) {
      this.pushRecord(record);
    }

    return record;
  }

  // Push an admin-issued time correction to the DB and write the matching
  // `attendance_adjustments` audit row in one round-trip.
  private pushRecordAndAudit(
    recordId: string,
    field: 'timeIn' | 'timeOut',
    before: Date | undefined,
    after: Date | undefined,
  ): void {
    if (this.dbSyncing.has(recordId)) return;
    this.dbSyncing.add(recordId);

    void (async () => {
      try {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;
        const pushed = await upsertAttendanceRecord({
          email: record.userId,
          date: record.date,
          timeIn: record.timeIn ?? null,
          timeOut: record.timeOut ?? null,
          exceeded: record.exceeded === true,
          extraSessions: record.extraSessions ?? [],
        });
        await logAttendanceAdjustment({
          attendanceId: pushed.id,
          fieldName: field === 'timeIn' ? 'time_in' : 'time_out',
          oldValue: before ? before.toISOString() : null,
          newValue: after ? after.toISOString() : null,
          reason: 'Admin manual adjustment',
        });
      } catch (err) {
        console.warn("[attendanceStore] adjustment audit failed:", err);
      }
    })();
  }

  // ── Absence / leave overrides (admin monitoring) ──────────────────────
  setAbsence(userId: string, date: string, type: AbsenceType | null): void {
    const key = `${userId}|${date}`;
    if (!type) {
      this.absences.delete(key);
    } else {
      this.absences.set(key, type);
    }
    this.persistAbsences();
    this.notify();
    this.pushAbsence(userId, date, type);
  }

  getAbsence(userId: string, date: string): AbsenceType | null {
    return this.absences.get(`${userId}|${date}`) ?? null;
  }

  // ── Check if a specific user is currently clocked in ─────────────────
  isUserAvailable(userId: string): boolean {
    return this.getNextAction(userId) === 'time-out';
  }

  // ── Check if any user in a role is currently clocked in ──────────────
  isRoleAvailable(role: 'admin' | 'staff'): boolean {
    const today = toDateKey(nowPHT());
    return this.records.some(r => r.role === role && r.date === today && hasActiveSession(r));
  }

  // ── Backward-compat: availability for legacy consumers ────────────────
  getAvailability(): { admin: UserAvailability; staff: UserAvailability } {
    const buildAvailability = (role: 'admin' | 'staff'): UserAvailability => {
      const today = toDateKey(nowPHT());
      const activeRecord = this.records.find(
        r => r.role === role && r.date === today && hasActiveSession(r),
      );
      if (!activeRecord) return { isTimedIn: false };

      const session = hasActiveSession(activeRecord)
        ? activeRecord.timeIn && !activeRecord.timeOut
          ? activeRecord
          : activeRecord.extraSessions.find(s => s.timeIn && !s.timeOut)!
        : activeRecord;

      const legacyLog: AttendanceLog = {
        id:       activeRecord.id,
        userId:   activeRecord.userId,
        userName: activeRecord.userName,
        role:     activeRecord.role,
        timeIn:   session.timeIn!,
        status:   'active',
      };

      return { isTimedIn: true, currentLog: legacyLog };
    };

    return {
      admin: buildAvailability('admin'),
      staff: buildAvailability('staff'),
    };
  }

  // ── Backward-compat: getCurrentSession for existing consumers ─────────
  getCurrentSession(userId: string): AttendanceLog | null {
    const today = toDateKey(nowPHT());
    const key = (userId || '').toLowerCase();
    const record = this.records.find(r => r.userId.toLowerCase() === key && r.date === today);
    if (!record || !hasActiveSession(record)) return null;

    const activeTimeIn =
      record.timeIn && !record.timeOut
        ? record.timeIn
        : record.extraSessions.find(s => s.timeIn && !s.timeOut)!.timeIn!;

    return {
      id:       record.id,
      userId:   record.userId,
      userName: record.userName,
      role:     record.role,
      timeIn:   activeTimeIn,
      status:   'active',
    };
  }

  // ── Compute total worked hours for a record ───────────────────────────
  getTotalHours(record: DailyAttendanceRecord): number {
    return parseFloat((sessionTotalMs(record) / 3_600_000).toFixed(2));
  }

  // ── Overall daily status ──────────────────────────────────────────────
  getDayStatus(record: DailyAttendanceRecord): 'Complete' | 'Exceeded' | 'Incomplete' | 'Active' {
    if (hasActiveSession(record)) return 'Active';
    if (record.timeIn && record.timeOut) return record.exceeded ? 'Exceeded' : 'Complete';
    return 'Incomplete';
  }
}

export const attendanceStore = new AttendanceStore();
