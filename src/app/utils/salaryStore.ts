// ── Salary tracking store — hourly-rate × attended hours ────────────────────
// Salary is computed per staff member from their attendance records:
//   Current Salary = Total Approved Working Hours (current period) × Hourly Rate
// Attendance is the only source of worked time — a staff member is paid for the
// shifts they actually clocked. The Monday–Friday schedule is naturally honored
// because weekend days with no attendance simply produce no hours (weekend
// attendance, if any, still counts as worked time). Releasing a salary marks the
// current period paid, stores a history record, and starts a NEW period — the
// attendance records themselves are never deleted.
//
// Supabase-backed facade: the localStorage mirror stays as the offline /
// anonymous fallback, but the DB is now the source of truth when available —
// `salary_settings` holds the admin-set hourly rate and `salary_releases` the
// cross-device history (emails/names resolved by the repo). Writes are
// staff/admin only (customers never read salary data).
import { attendanceStore, sessionTotalMs, nowPHT } from "./attendanceStore";
import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady } from '../../lib/supabaseClient';
import {
  fetchSalaryReleases,
  fetchSalarySettings,
  insertSalaryRelease,
  resolveStaffRecordIdByEmail,
  sessionUserId,
  upsertSalarySettings,
} from '../../lib/db/staffRepo';

// ── Types ────────────────────────────────────────────────────────────────────
export type SalaryReleaseRecord = {
  id: string;
  staffEmail: string;
  staffName: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  totalHours: number;
  hourlyRate: number;
  amount: number;
  releasedAt: string;  // ISO instant
  releasedBy: string;
};

export type StaffSalarySummary = {
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  hourlyRate: number;
  amount: number;
};

type SalaryState = {
  hourlyRate: number;
  releases: SalaryReleaseRecord[];
  periodStarts: Record<string, string>; // staff email (lowercased) -> period start YYYY-MM-DD
};

type Subscriber = () => void;

const MS_PER_HOUR = 3_600_000;
const STORAGE_KEY = "docufy_salary_state_v1";

const pad2 = (n: number): string => String(n).padStart(2, "0");

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const addDays = (key: string, days: number): string => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dateKey(dt);
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

const defaultPeriodStart = (): string => {
  const p = nowPHT();
  return `${p.getFullYear()}-${pad2(p.getMonth() + 1)}-01`;
};

const DEFAULT_STATE = (): SalaryState => ({
  hourlyRate: 50,
  releases: [],
  periodStarts: {},
});

// ── Store ────────────────────────────────────────────────────────────────────
class SalaryStore {
  private state: SalaryState = DEFAULT_STATE();
  private subscribers: Set<Subscriber> = new Set();
  private hydrating = false;

  constructor() {
    this.restore();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", this.onStorage);
    }
    subscribeTableChanges('salary_settings', () => {
      void this.hydrate();
    });
    subscribeTableChanges('salary_releases', () => {
      void this.hydrate();
    });
    void this.hydrate();
  }

  // Cross-tab live sync: when another tab writes salary state (release, rate,
  // period starts), reload from localStorage and notify subscribers.
  private onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      this.restore();
      this.notify();
    }
  };

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SalaryState>;
      this.state = {
        hourlyRate: typeof parsed.hourlyRate === "number" && parsed.hourlyRate > 0 ? parsed.hourlyRate : 50,
        releases: Array.isArray(parsed.releases) ? parsed.releases.filter(r => r && r.id && r.staffEmail && r.staffEmail.toLowerCase() === r.staffEmail) : [],
        periodStarts: parsed.periodStarts && typeof parsed.periodStarts === "object" ? parsed.periodStarts : {},
      };
    } catch {
      this.state = DEFAULT_STATE();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // storage unavailable — salary state stays in-memory for the session
    }
  }

  private notify(): void {
    this.subscribers.forEach(cb => cb());
  }

  // Pull the DB source of truth: the settings row wins for the hourly rate, and
  // every release row wins for the history (replacing the mirror). periodStarts
  // has no DB home — it is derived from the fetched releases (period_end + 1),
  // merged over any local override. Concurrent calls dedupe; failures keep the
  // mirror quietly.
  private async hydrate(): Promise<void> {
    if (this.hydrating) return;
    this.hydrating = true;
    await authReady;
    try {
      const [settings, releases] = await Promise.all([
        fetchSalarySettings(),
        fetchSalaryReleases(),
      ]);

      const next: SalaryState = { ...this.state };

      if (settings && typeof settings.hourly_rate === "number" && settings.hourly_rate > 0) {
        next.hourlyRate = settings.hourly_rate;
      }

      if (releases.length > 0) {
        const periodStarts = { ...this.state.periodStarts };
        next.releases = releases.map((r) => ({
          id: r.id,
          staffEmail: r.staffEmail.toLowerCase(),
          staffName: r.staffName,
          periodStart: r.periodStart,
          periodEnd: r.periodEnd,
          totalHours: r.totalHours,
          hourlyRate: r.hourlyRate,
          amount: round2(r.releasedAmount),
          releasedAt: r.releasedAt,
          releasedBy: r.releasedByName,
        }));
        for (const r of next.releases) {
          if (r.staffEmail) periodStarts[r.staffEmail] = addDays(r.periodEnd, 1);
        }
        next.periodStarts = periodStarts;
      }

      this.state = next;
      this.persist();
      this.notify();
    } catch (err) {
      console.warn('[salary] hydration kept local data:', err);
    } finally {
      this.hydrating = false;
    }
  }

  async refreshFromBackend(): Promise<void> {
    await this.hydrate();
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // ── Hourly rate (admin-configured) ─────────────────────────────────────
  getHourlyRate(): number {
    return this.state.hourlyRate;
  }

  setHourlyRate(rate: number): void {
    const safe = Math.max(0, Number(rate) || 0);
    this.state.hourlyRate = round2(safe);
    this.persist();
    this.notify();
    void this.syncRate(this.state.hourlyRate);
  }

  // Best-effort push of the hourly rate; adopted back only via the DB snapshot.
  private async syncRate(rate: number): Promise<void> {
    try {
      const uid = await sessionUserId();
      const patch: { hourly_rate: number; updated_by?: string | null } = { hourly_rate: rate };
      if (uid) patch.updated_by = uid;
      await upsertSalarySettings(patch);
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('salary.update', err);
      else console.warn('[salary] not synced (RLS):', err);
    }
  }

  // ── Salary period ──────────────────────────────────────────────────────
  getPeriodStart(email: string): string {
    const key = (email || "").toLowerCase();
    const start = this.state.periodStarts[key] ?? defaultPeriodStart();
    const today = todayPHT();
    // After a release the next period starts the day AFTER the release day; on
    // the release day itself that start is still "tomorrow", which would make
    // the current-period window [tomorrow → today] inverted/empty and hide the
    // staff's same-day clock-ins ("0 days"). Clamp to today so the window is
    // never inverted and today's records always appear.
    return start > today ? today : start;
  }

  private recordsFor(staffEmail: string, startKey: string, endKey: string) {
    const key = staffEmail.toLowerCase();
    return attendanceStore
      .getAllLogs()
      .filter(r => r.userId.toLowerCase() === key && r.date >= startKey && r.date <= endKey)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // ── Current-period summary (period start → today, PHT) ─────────────────
  getStaffSummary(email: string): StaffSalarySummary {
    const periodStart = this.getPeriodStart(email);
    const periodEnd = todayPHT();
    const records = this.recordsFor(email, periodStart, periodEnd);
    const totalMs = records.reduce((sum, r) => sum + sessionTotalMs(r, nowPHT()), 0);
    const totalHours = round2(totalMs / MS_PER_HOUR);
    const rate = this.state.hourlyRate;
    return {
      periodStart,
      periodEnd,
      totalHours,
      hourlyRate: rate,
      amount: round2(totalHours * rate),
    };
  }

  // ── Attendance records within the current period (for the detail table) ─
  getPeriodAttendance(email: string) {
    const periodStart = this.getPeriodStart(email);
    return this.recordsFor(email, periodStart, todayPHT());
  }

  // ── Release salary ─────────────────────────────────────────────────────
  releaseSalary(email: string, name: string, releasedBy: string): SalaryReleaseRecord {
    const key = (email || "").toLowerCase();
    const summary = this.getStaffSummary(email);
    const record: SalaryReleaseRecord = {
      id: `SAL-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      staffEmail: email,
      staffName: name,
      periodStart: summary.periodStart,
      periodEnd: summary.periodEnd,
      totalHours: summary.totalHours,
      hourlyRate: summary.hourlyRate,
      amount: summary.amount,
      releasedAt: new Date().toISOString(),
      releasedBy,
    };
    // Mark current period paid and start a NEW period the day after the release.
    // Attendance history is intentionally left intact.
    this.state.releases = [record, ...this.state.releases];
    this.state.periodStarts[key] = addDays(summary.periodEnd, 1);
    this.persist();
    this.notify();
    void this.syncRelease(email, record);
    return record;
  }

  // Best-effort push of a salary release: resolve the roster row for the email,
  // INSERT the history row, then adopt the server uuid into the local record so
  // history + realtime reconcile to one entry. Failures keep the local record.
  private async syncRelease(email: string, record: SalaryReleaseRecord): Promise<void> {
    try {
      const staffId = await resolveStaffRecordIdByEmail(email);
      if (!staffId) {
        console.warn('[salary] release kept local only (no staff_records row for', email, ')');
        return;
      }
      const uid = await sessionUserId();
      const id = await insertSalaryRelease({
        staff_id: staffId,
        period_start: record.periodStart,
        period_end: record.periodEnd,
        total_hours: record.totalHours,
        hourly_rate: record.hourlyRate,
        released_amount: record.amount,
        released_by: uid,
        released_at: record.releasedAt,
      });
      if (id) {
        this.state.releases = this.state.releases.map((r) => (r.id === record.id ? { ...r, id } : r));
        this.persist();
      }
    } catch (err) {
      if (!isRlsDenied(err)) showDbError('salary.release', err);
      else console.warn('[salary] release not synced (RLS):', err);
    }
  }

  // ── Salary history (per staff, newest first) ───────────────────────────
  getSalaryHistory(email: string): SalaryReleaseRecord[] {
    const key = (email || "").toLowerCase();
    return this.state.releases.filter(r => r.staffEmail.toLowerCase() === key);
  }
}

const todayPHT = (): string => dateKey(nowPHT());

export const salaryStore = new SalaryStore();
