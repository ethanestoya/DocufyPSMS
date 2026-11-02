// ── Staff roster for the Admin Attendance & Staff Monitoring view ───────────
// Roster = the staff STORE (the single master directory, itself a Supabase
// facade over `staff_records`) PLUS any additional staff who have clocked in
// via attendanceStore (e.g. accounts created through "Register New Staff"), so
// the monitoring page always shows the people who actually exist in the system.
//
// This used to be a hardcoded SEEDED_STAFF array, which meant the attendance
// view could show demo people who were never in the real staff directory (and
// never showed staff that only existed in the store). The store is now the
// source of truth.
import { attendanceStore, nowPHT } from "./attendanceStore";
import { staffStore } from "./staffStore";

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  position: string;
  role?: "Staff" | "Admin";
  shift?: string;
  attendanceStatus?: "active" | "on-leave";
  onLeaveReason?: string;
};

export const DEFAULT_STAFF_SHIFT = "8:00 AM - 5:00 PM";

const pad2 = (n: number): string => String(n).padStart(2, "0");

export const toDateKey = (d: Date = nowPHT()): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Cosmetic-only display metadata (job title + shift) for the seeded demo staff.
// `staff_records` has no position/shift columns, so this overlay only affects
// what the monitoring table renders as Role/Schedule — the roster itself comes
// from the store. Unknown emails fall back to the neutral defaults below.
const DEMO_META: Record<string, { position: string; shift: string }> = {
  "staff@test.com": { position: "Print Operator", shift: "8:00 AM - 5:00 PM" },
  "robert.chen@docufy.com": { position: "Print Operator", shift: "8:00 AM - 5:00 PM" },
  "katie.perry@docufy.com": { position: "Front Desk", shift: "9:00 AM - 6:00 PM" },
  "miguel.santos@docufy.com": { position: "Bindery Lead", shift: "8:00 AM - 6:00 PM" },
  "ana.delacruz@docufy.com": { position: "Cashier", shift: "8:30 AM - 5:30 PM" },
};

const metaFor = (email: string): { position: string; shift: string } =>
  DEMO_META[email.toLowerCase()] ?? { position: "Staff", shift: DEFAULT_STAFF_SHIFT };

export const getStaffRoster = (): StaffMember[] => {
  const roster: StaffMember[] = [];
  const known = new Set<string>();

  // Directory of record — the staff store (localStorage mirror + Supabase).
  for (const s of staffStore.getStaff()) {
    const email = (s.email || "").toLowerCase();
    if (!email || known.has(email)) continue;
    const meta = metaFor(email);
    roster.push({
      id: s.id,
      name: s.name || email,
      email: s.email,
      position: meta.position,
      role: s.role === "Admin" ? "Admin" : "Staff",
      shift: meta.shift,
      attendanceStatus: s.attendanceStatus ?? "active",
      onLeaveReason: s.onLeaveReason,
    });
    known.add(email);
  }

  // Log-only staff (clocked in but not in the directory) are appended so
  // nothing that has attendance history is dropped from the monitoring page.
  attendanceStore
    .getAllLogs()
    .filter((log) => log.role === "staff")
    .forEach((log) => {
      const email = log.userId.toLowerCase();
      if (known.has(email)) return;
      const meta = metaFor(email);
      roster.push({
        id: log.id,
        name: log.userName,
        email: log.userId,
        position: meta.position,
        role: "Staff",
        shift: meta.shift,
      });
      known.add(email);
    });

  return roster;
};

// ── Demo seed (today only, idempotent) ──────────────────────────────────────
// Paints a realistic monitoring snapshot on first load so the dashboard is not
// empty: one staff On Leave (Heaven — persistent on-leave status), one
// Automatically Absent (Ana — no clock-in), one Overtime, and two still on the
// clock (so the "Currently Working" strip has live rows).
// Skips staff@test.com (the staff test account)'s clock flow — leaving that
// untouched.
//
// IMPORTANT: this only runs when the attendance store is completely empty.
// Once ANY real record exists it never injects demo clock-ins again, so demo
// data can never be written into backend tables that already hold real data.
export const seedDemoAttendance = (): void => {
  if (attendanceStore.getAllLogs().length > 0) return;

  const byEmail = new Map(getStaffRoster().map((m) => [m.email.toLowerCase(), m]));
  const member = (email: string): StaffMember | undefined => byEmail.get(email.toLowerCase());

  const today = toDateKey();
  // Times are expressed as PHT wall-clock times (seeded demo mirrors PH shift).
  // Build the real UTC instant whose Manila wall-clock equals (today, h:m) — done
  // via Date.UTC with the −8h offset so it is correct on ANY device timezone.
  const at = (h: number, m: number): Date => {
    const base = nowPHT();
    return new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate(), h - 8, m, 0, 0));
  };

  const seedDay = (staff: StaffMember | undefined, timeIn: Date, timeOut: Date) => {
    if (!staff || attendanceStore.getRecord(staff.email, today)) return;
    attendanceStore.upsertTime(staff.email, staff.name, "staff", today, "timeIn", timeIn, false);
    attendanceStore.upsertTime(staff.email, staff.name, "staff", today, "timeOut", timeOut, false);
  };

  // Clock-in only (no time-out) so the record stays live on the monitor.
  const seedLive = (staff: StaffMember | undefined, timeIn: Date) => {
    if (!staff || attendanceStore.getRecord(staff.email, today)) return;
    attendanceStore.upsertTime(staff.email, staff.name, "staff", today, "timeIn", timeIn, false);
  };

  // Robert Chen — Present, On Time, still on the clock (8:00 start)
  seedLive(member("robert.chen@docufy.com"), at(8, 0));

  // Katie Perry — Present, Late, still on the clock (9:42 start)
  seedLive(member("katie.perry@docufy.com"), at(9, 42));

  // Miguel Santos — Present, Overtime (8:05 start, 10h total, clocked out)
  seedDay(member("miguel.santos@docufy.com"), at(8, 5), at(18, 5));

  // Heaven Rica is On Leave via her persistent roster status; Ana Dela Cruz
  // has no clock-in, so she shows as Absent automatically. No per-day absence
  // mark is seeded here — an admin's Edit-dialog choice is never overwritten.
};
