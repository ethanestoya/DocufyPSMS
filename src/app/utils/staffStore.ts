// ── Staff directory store — persisted staff list ────────────────────────────
// The Staff Management page used to keep its roster in local component state,
// so any change was lost on refresh while the auth account (which controls the
// actual login role) was already updated — that mismatch made a Staff→Admin
// role change look like it reverted. This store persists the roster itself
// (localStorage), while AuthContext persists the matching staff/admin sign-in
// accounts, keeping the displayed role and the real login permission in sync.
//
// Supabase-backed facade: the localStorage mirror stays as the offline /
// anonymous fallback, but `staff_records` (the roster assigned to real staff
// sign-ins) is the source of truth when rows exist. The nested demo data
// (performance notes / allowances / tasks) has no admin editor — it is
// hydrate-only and re-attached from its sub-tables by staff_records id.
// Writes are staff/admin only (customers never read this).
import { attendanceStore } from "./attendanceStore";
import { subscribeTableChanges } from '../../lib/db/hooks';
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { auditLogStore, type AuditChange } from './auditLogStore';
import { authReady } from '../../lib/supabaseClient';
import {
  fetchStaffAllowances,
  fetchStaffPerformanceNotes,
  fetchStaffRecords,
  fetchStaffTasks,
  saveStaffMember,
} from '../../lib/db/staffRepo';
import type { StaffAllowanceRow, StaffPerformanceNoteRow, StaffRecordInsert, StaffRecordRow, StaffTaskRow } from '../../lib/db/types';

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: "Active" | "Inactive";
  attendanceStatus: "active" | "on-leave";
  onLeaveReason: string;
  joinDate: string;
  skillsMessage: string;
  portfolioLink: string;
  performanceNotes: {
    date: string;
    note: string;
    rating: number;
  }[];
  salary: number;
  allowances: { type: string; amount: number }[];
  paymentHistory: {
    date: string;
    amount: number;
    type: string;
  }[];
  permissions: string[];
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string;
  }[];
}

const STORAGE_KEY = "docufy_staff_list_v1";

export const DEFAULT_STAFF: Staff[] = [
  {
    id: "EMP-001",
    name: "Heaven Rica",
    email: "staff@test.com",
    phone: "0912 345 6789",
    role: "Staff",
    status: "Active",
    attendanceStatus: "on-leave",
    onLeaveReason: "On scheduled annual leave",
    joinDate: "2025-09-01",
    skillsMessage: "I have extensive experience in managing daily print operations, quality control, equipment maintenance, color management, and providing excellent customer service. Certified Print Professional with proven track record.",
    portfolioLink: "https://drive.google.com/heavenrica-portfolio",
    performanceNotes: [
      {
        date: "2026-04-01",
        note: "Excellent performance, handled rush orders efficiently",
        rating: 5,
      },
      {
        date: "2026-03-01",
        note: "Successfully trained 2 new staffs",
        rating: 5,
      },
      {
        date: "2026-02-01",
        note: "Improved print quality standards",
        rating: 4,
      },
    ],
    salary: 18000,
    allowances: [
      { type: "Transportation", amount: 2000 },
      { type: "Meal", amount: 1500 },
    ],
    paymentHistory: [
      {
        date: "2026-04-15",
        amount: 21500,
        type: "Monthly Salary",
      },
      {
        date: "2026-03-15",
        amount: 21500,
        type: "Monthly Salary",
      },
      {
        date: "2026-02-15",
        amount: 21500,
        type: "Monthly Salary",
      },
    ],
    permissions: [
      "view_orders",
      "edit_orders",
      "view_reports",
    ],
    tasks: [
      {
        id: "TSK-001",
        title: "Quality check for color prints",
        status: "Completed",
        priority: "High",
        dueDate: "2026-04-20",
      },
      {
        id: "TSK-002",
        title: "Train new staff on binding",
        status: "In Progress",
        priority: "Medium",
        dueDate: "2026-04-25",
      },
      {
        id: "TSK-003",
        title: "Printer toner check",
        status: "Pending",
        priority: "Low",
        dueDate: "2026-04-30",
      },
    ],
  },
  {
    id: "EMP-002",
    name: "Robert Chen",
    email: "robert.chen@docufy.com",
    phone: "0923 456 7890",
    role: "Staff",
    status: "Active",
    attendanceStatus: "active",
    onLeaveReason: "",
    joinDate: "2025-10-15",
    skillsMessage: "Proficient in printing operations, equipment setup, document binding, and customer support. Quick learner with attention to detail.",
    portfolioLink: "https://linkedin.com/in/robertchen",
    performanceNotes: [
      {
        date: "2026-04-01",
        note: "Good attendance and punctuality",
        rating: 4,
      },
      {
        date: "2026-03-01",
        note: "Needs improvement in color matching",
        rating: 3,
      },
    ],
    salary: 15000,
    allowances: [{ type: "Transportation", amount: 1500 }],
    paymentHistory: [
      {
        date: "2026-04-15",
        amount: 16500,
        type: "Monthly Salary",
      },
      {
        date: "2026-03-15",
        amount: 16500,
        type: "Monthly Salary",
      },
    ],
    permissions: ["view_orders", "edit_orders"],
    tasks: [
      {
        id: "TSK-004",
        title: "Process customer orders",
        status: "Completed",
        priority: "High",
        dueDate: "2026-04-21",
      },
      {
        id: "TSK-005",
        title: "Clean and maintain printers",
        status: "Completed",
        priority: "Medium",
        dueDate: "2026-04-22",
      },
    ],
  },
  {
    id: "EMP-003",
    name: "Katie Perry",
    email: "katie.perry@docufy.com",
    phone: "0934 567 8901",
    role: "Staff",
    status: "Active",
    attendanceStatus: "active",
    onLeaveReason: "",
    joinDate: "2026-01-10",
    skillsMessage: "Excellent customer service skills, experienced in payment processing, order management, and professional communication.",
    portfolioLink: "",
    performanceNotes: [
      {
        date: "2026-04-01",
        note: "Excellent customer service skills",
        rating: 5,
      },
      {
        date: "2026-03-01",
        note: "Quick learner, adapting well to role",
        rating: 4,
      },
    ],
    salary: 14000,
    allowances: [{ type: "Meal", amount: 1000 }],
    paymentHistory: [
      {
        date: "2026-04-15",
        amount: 15000,
        type: "Monthly Salary",
      },
      {
        date: "2026-03-15",
        amount: 15000,
        type: "Monthly Salary",
      },
      {
        date: "2026-02-15",
        amount: 15000,
        type: "Monthly Salary",
      },
    ],
    permissions: ["view_orders", "verify_payments"],
    tasks: [
      {
        id: "TSK-006",
        title: "Verify payment receipts",
        status: "In Progress",
        priority: "High",
        dueDate: "2026-04-22",
      },
      {
        id: "TSK-007",
        title: "Update customer database",
        status: "Pending",
        priority: "Low",
        dueDate: "2026-04-28",
      },
    ],
  },
];

type Subscriber = () => void;

// Backfills any missing fields on records loaded from storage so older data
// (saved before a field existed) still behaves correctly. "absent" is no
// longer a stored status — a staff member who doesn't clock in is simply
// shown as Absent automatically, so any legacy "absent" value converts to
// "active". Demo staff inherit their seeded on-leave status when the field
// has never been set; once the admin picks a status it is stored and honored
// from then on.
const DEMO_ATTENDANCE_STATUS: Record<string, "on-leave"> = {
  "staff@test.com": "on-leave",
};

function normalizeStaff(s: Staff): Staff {
  const stored = s.attendanceStatus;
  const onLeave = stored === "on-leave" || (stored !== "active" && stored !== "absent" && DEMO_ATTENDANCE_STATUS[s.email.toLowerCase()] === "on-leave");
  return {
    ...s,
    attendanceStatus: onLeave ? "on-leave" : "active",
    onLeaveReason: onLeave ? (s.onLeaveReason?.trim() ? s.onLeaveReason : "Not specified") : "",
  };
}

// ── DB → store mappings (keep the exact consumer-facing Staff shape) ─────────

function rowToStaff(
  row: StaffRecordRow,
  notesByStaff: Map<string, { date: string; note: string; rating: number }[]>,
  allowancesByStaff: Map<string, { type: string; amount: number }[]>,
  tasksByStaff: Map<string, { id: string; title: string; status: string; priority: string; dueDate: string }[]>,
  index: number,
): Staff {
  const attendanceStatus: "active" | "on-leave" =
    row.attendance_status === "on-leave" ? "on-leave" : "active";
  return normalizeStaff({
    id: row.employee_code || `EMP-${String(index + 1).padStart(3, "0")}`,
    name: row.full_name || "",
    email: (row.email || "").toLowerCase(),
    phone: row.phone || "",
    role: row.role === "admin" ? "Admin" : "Staff",
    status: row.status === "Inactive" ? "Inactive" : "Active",
    attendanceStatus,
    onLeaveReason: attendanceStatus === "on-leave" ? row.on_leave_reason || "Not specified" : "",
    joinDate: row.join_date || "",
    skillsMessage: row.skills_message || "",
    portfolioLink: row.portfolio_link || "",
    performanceNotes: notesByStaff.get(row.id) ?? [],
    salary: row.salary ?? 0,
    allowances: allowancesByStaff.get(row.id) ?? [],
    paymentHistory: [], // hydrate-only demo data without a DB home
    permissions: row.permissions ?? [],
    tasks: tasksByStaff.get(row.id) ?? [],
  });
}

function toRecordInsert(s: Staff, profileId: string | null): StaffRecordInsert {
  return {
    profile_id: profileId,
    employee_code: s.id,
    full_name: s.name,
    email: s.email.toLowerCase(),
    phone: s.phone || null,
    role: s.role === "Admin" ? "admin" : "staff",
    status: s.status === "Inactive" ? "Inactive" : "Active",
    attendance_status: s.attendanceStatus || "active",
    on_leave_reason: s.onLeaveReason?.trim() ? s.onLeaveReason : null,
    join_date: s.joinDate,
    skills_message: s.skillsMessage || null,
    portfolio_link: s.portfolioLink || null,
    permissions: s.permissions ?? [],
    salary: s.salary ?? 0,
  };
}

// ── Store ────────────────────────────────────────────────────────────────────
class StaffStore {
  private list: Staff[] = DEFAULT_STAFF;
  private subscribers: Set<Subscriber> = new Set();
  private hydrating = false;
  private hydrated = false;
  // staff_records.id per lowercased email + the linked profile id, learned at
  // hydrate so saves UPDATE the existing row (and never clobber its profile
  // link with null) instead of inserting a duplicate.
  private recordIdsByEmail: Map<string, string> = new Map();
  private profileIdsByEmail: Map<string, string | null> = new Map();

  constructor() {
    this.restore();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", this.onStorage);
    }
    subscribeTableChanges('staff_records', () => {
      void this.hydrate();
    });
    void this.hydrate();
  }

  private onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      this.restore();
      this.notify();
    }
  };

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Staff[];
      if (!Array.isArray(parsed)) return;
      this.list = parsed.filter(
        (s) => s && typeof s === "object" && typeof s.email === "string" && typeof s.name === "string",
      ).map(normalizeStaff);
      if (this.list.length === 0) this.list = DEFAULT_STAFF;
    } catch {
      this.list = DEFAULT_STAFF;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.list));
    } catch {
      // storage unavailable — roster stays in-memory for the session
    }
  }

  // Pull the full roster + nested demo rows from the DB. The DB wins whenever
  // it has rows (replacing the mirror); an empty/unreachable backend keeps the
  // localStorage roster. Concurrent calls dedupe; failures degrade quietly.
  private async hydrate(): Promise<void> {
    if (this.hydrating) return;
    this.hydrating = true;
    await authReady;
    try {
      const rows = await fetchStaffRecords();
      if (rows.length === 0) return; // not seeded — keep the mirror
      const [notes, allowances, tasks] = await Promise.all([
        fetchStaffPerformanceNotes(),
        fetchStaffAllowances(),
        fetchStaffTasks(),
      ]);
      const notesByStaff = groupNotes(notes);
      const allowancesByStaff = groupAllowances(allowances);
      const tasksByStaff = groupTasks(tasks);

      const recordIds = new Map<string, string>();
      const profileIds = new Map<string, string | null>();
      const next = rows.map((row, i) => {
        const email = (row.email || "").toLowerCase();
        if (email) {
          recordIds.set(email, row.id);
          profileIds.set(email, row.profile_id);
        }
        return rowToStaff(row, notesByStaff, allowancesByStaff, tasksByStaff, i);
      });

      this.recordIdsByEmail = recordIds;
      this.profileIdsByEmail = profileIds;
      this.list = next;
      this.hydrated = true;
      this.persist();
      this.notify();
    } catch (err) {
      console.warn('[staff] hydration kept local roster:', err);
    } finally {
      this.hydrating = false;
    }
  }

  private ensureHydrated(): void {
    if (!this.hydrated && !this.hydrating) void this.hydrate();
  }

  async refreshFromBackend(): Promise<void> {
    await this.hydrate();
  }

  getStaff(): Staff[] {
    this.ensureHydrated();
    return this.list.map((s) => ({ ...s }));
  }

  setStaff(next: Staff[]): void {
    const prev = this.list;
    this.list = next.map((s) => normalizeStaff({ ...s }));
    this.persist();
    this.notify();
    void this.syncAll();
    this.recordRosterDiff(prev, this.list);
  }

  // Audit the roster diff — new members, edits (role/status/salary/contact),
  // and removals — so a "who changed staff" question has an answer in the log.
  private recordRosterDiff(prev: Staff[], next: Staff[]): void {
    const prevByEmail = new Map(prev.map((s) => [s.email.toLowerCase(), s]));
    const nextByEmail = new Map(next.map((s) => [s.email.toLowerCase(), s]));
    const compareFields: { label: string; key: keyof Pick<Staff, 'name' | 'email' | 'role' | 'status' | 'phone' | 'salary'> }[] = [
      { label: 'Name', key: 'name' },
      { label: 'Email', key: 'email' },
      { label: 'Role', key: 'role' },
      { label: 'Account Status', key: 'status' },
      { label: 'Phone', key: 'phone' },
      { label: 'Salary', key: 'salary' },
    ];

    for (const current of next) {
      const key = current.email.toLowerCase();
      const old = prevByEmail.get(key);
      if (!old) {
        auditLogStore.record({
          module: 'Staff',
          action: 'Created',
          reference: current.name || current.email,
          entityType: 'Staff',
          entityId: current.id,
          title: 'Staff Member Added',
          description: `Added ${current.name} (${current.email}) to the staff roster with role ${current.role}.`,
        });
        continue;
      }
      const changes: AuditChange[] = [];
      for (const f of compareFields) {
        if (String(old[f.key] ?? '') !== String(current[f.key] ?? '')) {
          changes.push({
            field: f.label,
            previous: String(old[f.key] ?? '—'),
            next: String(current[f.key] ?? '—'),
          });
        }
      }
      if (changes.length > 0) {
        auditLogStore.record({
          module: 'Staff',
          action: 'Updated',
          reference: current.name || current.email,
          entityType: 'Staff',
          entityId: current.id,
          title: 'Staff Member Updated',
          description: `Updated the staff record for ${current.name} (${current.email}).`,
          changes,
        });
      }
    }

    for (const removed of prev) {
      if (!nextByEmail.has(removed.email.toLowerCase())) {
        auditLogStore.record({
          module: 'Staff',
          action: 'Deleted',
          reference: removed.name || removed.email,
          entityType: 'Staff',
          entityId: removed.id,
          title: 'Staff Member Removed',
          description: `Removed ${removed.name} (${removed.email}) from the staff roster.`,
        });
      }
    }
  }

  // Best-effort push of the whole roster: syncs the DB only after hydration so
  // row ids + profile links are known (updates target existing rows, inserts
  // mint new ones and adopt their uuid). RLS-denied writes degrade quietly;
  // every other failure toasts.
  private async syncAll(): Promise<void> {
    // Snapshot the roster before re-hydrating: hydrate() REPLACES this.list
    // with the DB rows, so any just-added local staff would be dropped before
    // the push loop (their saveStaffMember would never run).
    const batch = this.list.map((s) => ({ ...s }));
    await this.hydrate();
    for (const s of batch) {
      const email = s.email.toLowerCase();
      const existingId = this.recordIdsByEmail.get(email);
      const profileId = this.profileIdsByEmail.get(email) ?? null;
      try {
        const adopted = await saveStaffMember({ id: existingId, row: toRecordInsert(s, profileId) });
        this.recordIdsByEmail.set(email, adopted);
        this.profileIdsByEmail.set(email, profileId);
      } catch (err) {
        if (!isRlsDenied(err)) showDbError('staff.update', err);
        else console.warn('[staff] not synced (RLS):', err);
      }
    }
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    this.subscribers.forEach((cb) => cb());
  }
}

function groupNotes(rows: StaffPerformanceNoteRow[]): Map<string, { date: string; note: string; rating: number }[]> {
  const map = new Map<string, { date: string; note: string; rating: number }[]>();
  for (const r of rows) {
    const entry = { date: r.note_date || '', note: r.note || '', rating: r.rating ?? 0 };
    const list = map.get(r.staff_id) ?? [];
    list.push(entry);
    map.set(r.staff_id, list);
  }
  return map;
}

function groupAllowances(rows: StaffAllowanceRow[]): Map<string, { type: string; amount: number }[]> {
  const map = new Map<string, { type: string; amount: number }[]>();
  for (const r of rows) {
    const entry = { type: r.allowance_type || '', amount: r.amount ?? 0 };
    const list = map.get(r.staff_id) ?? [];
    list.push(entry);
    map.set(r.staff_id, list);
  }
  return map;
}

function groupTasks(rows: StaffTaskRow[]): Map<string, { id: string; title: string; status: string; priority: string; dueDate: string }[]> {
  const map = new Map<string, { id: string; title: string; status: string; priority: string; dueDate: string }[]>();
  for (const r of rows) {
    const entry = { id: r.id, title: r.title || '', status: r.status || '', priority: r.priority || '', dueDate: r.due_date || '' };
    const list = map.get(r.staff_id) ?? [];
    list.push(entry);
    map.set(r.staff_id, list);
  }
  return map;
}

export const staffStore = new StaffStore();

// Staff who appear in the directory AND have attendance records (used by
// AdminAttendance's AttendanceView: seeded staff + anyone who ever clocked in).
export function getStaffRosterFromRecords(): { email: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const s of staffStore.getStaff()) seen.set(s.email.toLowerCase(), s.name);
  for (const r of attendanceStore.getAllLogs()) {
    if (!seen.has(r.userId.toLowerCase())) seen.set(r.userId.toLowerCase(), r.userName);
  }
  return Array.from(seen.entries()).map(([email, name]) => ({ email, name }));
}
