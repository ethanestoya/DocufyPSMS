// Shared attendance view-model used by the merged Staff Management page.
// Extracted from the old AdminAttendance.tsx so the directory, the today KPI
// band, the per-staff detail pane, and the day modal all build rows the same way.
import React, { useState, useEffect, useMemo } from "react";
import {
  attendanceStore,
  sessionTotalMs,
  hasActiveSession,
  STANDARD_DAILY_HOURS,
  formatPHT,
  PHT_OFFSET_MS,
} from "./attendanceStore";
import type {
  AbsenceType,
  DailyAttendanceRecord,
} from "./attendanceStore";
import {
  seedDemoAttendance,
  toDateKey,
  DEFAULT_STAFF_SHIFT,
} from "./staffRoster";
import { formatPHTime, toPHTInputValue, fromPHTInputValue } from "./pht";
import type { StaffMember } from "./staffRoster";

export type Presence = "present" | "no-clock-in" | "absent" | "on-leave";

export type AdminRow = {
  key: string;
  member: StaffMember;
  date: string;
  record: DailyAttendanceRecord | null;
  clockIn?: Date;
  clockOut?: Date;
  isLive: boolean;
  totalMs: number;
  onTime: boolean;
  late: boolean;
  overtime: boolean;
  exceeded: boolean;
  absence: AbsenceType | null;
  presence: Presence;
};

export const LATE_CUTOFF = { hour: 8, minute: 30 };
export const MS_PER_HOUR = 3_600_000;

// Fallbacks for staff who lack the (optional) roster metadata.
export const roleOf = (m: StaffMember): "Staff" | "Admin" => m.role ?? "Staff";
export const scheduleOf = (m: StaffMember): string => m.shift ?? DEFAULT_STAFF_SHIFT;

// ── Row builders ────────────────────────────────────────────────────────────
export function buildRow(
  member: StaffMember,
  dateKey: string,
  now: Date,
  override?: DailyAttendanceRecord | null,
): AdminRow {
  const rec = override ?? attendanceStore.getRecord(member.email, dateKey);
  // A staff member's persistent attendance status (set by the admin on the
  // Staff Management page) is authoritative and applies to every day until the
  // admin changes it. Today the only status an admin can set is "on-leave"
  // (with a reason); "absent" is NOT a stored status — anyone who doesn't
  // clock in shows as Absent automatically. Day-specific absence marks (from
  // the day modal) only apply when the persistent status is "active".
  const persistent: AbsenceType | null =
    member.attendanceStatus === "on-leave" ? "on-leave" : null;
  const absence: AbsenceType | null =
    persistent ?? attendanceStore.getAbsence(member.email, dateKey);

  const clockIn = rec?.timeIn;
  const clockOut = rec?.timeOut;

  const isLive = !!(
    rec &&
    dateKey === toDateKey(new Date(now.getTime() + PHT_OFFSET_MS)) &&
    hasActiveSession(rec)
  );

  const totalMs = rec ? sessionTotalMs(rec, now) : 0;

  // The 8:30 AM cutoff is a PHT wall-clock time, so interpret it as PHT.
  const lateCutKey = `${dateKey}T${String(LATE_CUTOFF.hour).padStart(2, "0")}:${String(
    LATE_CUTOFF.minute,
  ).padStart(2, "0")}:00`;
  const lateCutInstant = new Date(new Date(lateCutKey).getTime() - PHT_OFFSET_MS);
  const onTime = !!clockIn && clockIn.getTime() <= lateCutInstant.getTime();
  const late = !!clockIn && !onTime;
  const overtime = totalMs > STANDARD_DAILY_HOURS * MS_PER_HOUR;

  // A staff member who has not clocked in for the day is automatically Absent.
  let presence: Presence = "absent";
  if (absence === "on-leave") presence = "on-leave";
  else if (absence === "absent") presence = "absent";
  else if (clockIn) presence = "present";

  return {
    key: `${dateKey}-${member.email}`,
    member,
    date: dateKey,
    record: rec,
    clockIn,
    clockOut,
    isLive,
    totalMs,
    onTime,
    late,
    overtime,
    exceeded: rec?.exceeded === true,
    absence,
    presence,
  };
}

export function buildDayRows(members: StaffMember[], dateKey: string, now: Date): AdminRow[] {
  return members.map(m => buildRow(m, dateKey, now));
}

export function buildRangeRows(
  members: StaffMember[],
  from: string,
  to: string,
  now: Date,
): AdminRow[] {
  const byEmail = new Map(members.map(m => [m.email.toLowerCase(), m]));
  return attendanceStore
    .getAllLogs()
    .filter(l => l.role === "staff" && l.date >= from && l.date <= to)
    .map(l => {
      const member =
        byEmail.get(l.userId.toLowerCase()) ??
        { id: l.id, name: l.userName, email: l.userId, position: "Staff", role: "Staff", shift: DEFAULT_STAFF_SHIFT };
      return buildRow(member, l.date, now, l);
    });
}

// One member's records within a date range (drives the right-hand detail pane).
export function buildMemberRangeRows(
  member: StaffMember,
  from: string,
  to: string,
  now: Date,
): AdminRow[] {
  const key = member.email.toLowerCase();
  return attendanceStore
    .getAllLogs()
    .filter(l => l.role === "staff" && l.userId.toLowerCase() === key && l.date >= from && l.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(l => buildRow(member, l.date, now, l));
}

// ── Formatting helpers ──────────────────────────────────────────────────────
// Times render in Philippines time (PHT, UTC+8) regardless of device timezone.
export const fmtTime = (d?: Date): string => formatPHT(d);

// The same PHT time in 12-hour form with AM/PM, e.g. "9:42 AM".
export const fmtTime12 = (d?: Date): string => formatPHTime(d, { hour12: true });

export const fmtHms = (ms: number): string => {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes === 0) return "0h 00m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

export const fmtDay = (dateKey: string): string => {
  const d = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export const fmtLongDay = (dateKey: string): string => {
  const d = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(d.getTime()) ? dateKey : d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
};

// datetime-local input is expressed in the Manila wall-clock so what the admin
// picks matches the timezone the whole system reports in (device-independent).
export const toLocalInput = (d: Date): string => toPHTInputValue(d);

// Reverse of toLocalInput — treat the picked PHT string as a Manila wall-clock
// time and return the real UTC instant it denotes.
export const fromPHTInput = (iso: string): Date => fromPHTInputValue(iso);

export const initialsOf = (name: string): string =>
  name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase();

export type AdjustTarget = { row: AdminRow; field: "timeIn" | "timeOut" } | null;

// ── Today's attendance snapshot ─────────────────────────────────────────────
// Live-reacting rows + KPI counts for today, refreshed on a 30s tick and on
// every attendanceStore change.
export function useTodaySnapshot(members: StaffMember[], tickMs = 30_000) {
  const todayKey = toDateKey();
  const [now, setNow] = useState(new Date());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), tickMs);
    const unsubscribe = attendanceStore.subscribe(() => setVersion(v => v + 1));
    seedDemoAttendance();
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [tickMs]);

  const todayRows = useMemo(
    () => buildDayRows(members, todayKey, now),
    // `version` bumps on every attendanceStore change (absences, clock edits,
    // resets), so the rows must rebuild to reflect it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [members, now, version],
  );

  const kpis = useMemo(() => {
    const present = todayRows.filter(r => r.presence === "present");
    const onTime = present.filter(r => r.onTime).length;
    const late = present.filter(r => r.late).length;
    const onClock = todayRows.filter(r => r.isLive).length;
    const absent = todayRows.filter(r => r.presence === "absent").length;
    const noClock = todayRows.filter(r => r.presence === "no-clock-in").length;
    const away = todayRows.filter(r => r.presence === "on-leave").length;
    return { total: todayRows.length, present: present.length, onTime, late, absent, noClock, away, onClock };
  }, [todayRows]);

  const liveRows = useMemo(() => todayRows.filter(r => r.isLive), [todayRows]);

  const todayRowByEmail = useMemo(() => {
    const map = new Map<string, AdminRow>();
    for (const r of todayRows) map.set(r.member.email.toLowerCase(), r);
    return map;
  }, [todayRows]);

  return { todayKey, now, todayRows, kpis, liveRows, todayRowByEmail };
}
